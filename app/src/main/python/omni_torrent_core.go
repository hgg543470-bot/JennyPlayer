// OmniTorrent Core v3.5-ir (100% Pure Algorithmic Phonetic/Diphthong Engine + Catalog Consensus Discovery + 20 Slots + 7 P2P Indexers)
// Compile in Termux:
//   CGO_ENABLED=0 GOOS=android GOARCH=arm64 go build -buildmode=exe -ldflags="-s -w" -o libomnitorrent.so omni_torrent_core.go

package main

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
)

// ============================================================================
// 1. СТРУКТУРЫ ДАННЫХ И КОНФИГУРАЦИЯ (обратно совместимы с Python-клиентом)
// ============================================================================

type TorrentResult struct {
	Title      string  `json:"title"`
	Magnet     string  `json:"magnet"`
	InfoHash   string  `json:"info_hash"`
	Size       int64   `json:"size_bytes"`
	SizeMB     float64 `json:"size_mb"`
	SizeHuman  string  `json:"size_human"`
	Seeds      int     `json:"seeders"`
	Peers      int     `json:"peers"`
	Source     string  `json:"source"`
	Category   string  `json:"category,omitempty"`
	MatchedVia string  `json:"matched_via,omitempty"`
	MatchScore float64 `json:"match_score"`
	FinalRank  float64 `json:"final_rank"`
}

type VariantGroup struct {
	Query           string          `json:"query"`
	CategoryType    string          `json:"category_type,omitempty"`
	SuggestionTitle string          `json:"suggestion_title,omitempty"`
	Count           int             `json:"count"`
	Results         []TorrentResult `json:"results"`
}

type ResolvedTrackInfo struct {
	Artist string `json:"artist"`
	Track  string `json:"track"`
	Album  string `json:"album"`
	Role   string `json:"role,omitempty"` // "primary_artist", "other_artist_song", "album_match"
	Source string `json:"source,omitempty"`
}

type SearchResponse struct {
Status          string              `json:"status"`
InProgress      bool                `json:"in_progress"`
SnapshotVersion int                 `json:"snapshot_version"`
CompletedJobs   int                 `json:"completed_jobs"`
TotalJobs       int                 `json:"total_jobs"`
OriginalQuery   string              `json:"original_query"`
CorrectedQuery  string              `json:"corrected_query"`
ResolvedTracks  []ResolvedTrackInfo `json:"resolved_tracks,omitempty"`
ExpandedTerms   []string            `json:"expanded_terms"`
ElapsedMs       int64               `json:"elapsed_ms"`
TotalFound      int                 `json:"total_found"`
HiddenZero      int                 `json:"hidden_zero"`
Groups          []VariantGroup      `json:"groups"`
Results         []TorrentResult     `json:"results"`
}

type EngineConfig struct {
	TimeoutMs      int     `json:"timeout_ms"`
	PreferAudio    bool    `json:"prefer_audio"`
	Profile        string  `json:"profile"`
	EnablePhonetic bool    `json:"enable_phonetic"`
	EnableCatalog  bool    `json:"enable_catalog"`
	EnableUDP      bool    `json:"enable_udp"`
	FormatTag      string  `json:"format_tag"`
	Year           string  `json:"year"`
	ExactMatch     bool    `json:"exact"`
	ForceNew       bool    `json:"force_new"`
	HideZeroSeeds  bool    `json:"hide_zero"`
	MinTwoSeeds    bool    `json:"min_two_seeds"`
	MinFuzzyScore  float64 `json:"min_fuzzy_score"`

	// Настройки SoundCloud (приоритет №1) и кастомных P2P-сетей (Seeker/Soulseek, TorAPI RuTracker, SolidTorrents)
	EnableSoundCloud   bool   `json:"enable_soundcloud"`
	SoundCloudClientID string `json:"soundcloud_client_id,omitempty"`
	EnableSeekerP2P    bool   `json:"enable_seeker_p2p"`
	SlskdURL           string `json:"slskd_url,omitempty"`
	SlskdAPIKey        string `json:"slskd_api_key,omitempty"`
	SlskUsername       string `json:"slsk_user,omitempty"`
	SlskPassword       string `json:"slsk_pass,omitempty"`
	TorAPIURL          string `json:"torapi_url,omitempty"`

	// Настройки двойного логирования (управляются из Python через GET/POST, /config, CLI или ENV)
	DisableLogs     bool   `json:"disable_logs"`
	EnableSimpleLog bool   `json:"enable_simple_log"`
	EnableTraceLog  bool   `json:"enable_trace_log"`
	LogDir          string `json:"log_dir"`
	SimpleLogPath   string `json:"simple_log_path"`
	TraceLogPath    string `json:"trace_log_path"`
}

type candInfo struct {
	text     string
	tier     int     // Ступень приоритета: 1=SoundCloud, 2=Suggest/MusicBrainz, 3=iTunes/Deezer, 4=Фонетика/Дифтонги, 5=Исходный
	score    float64
	isArtist bool
	reason   string
}

type catalogEntity struct {
	text     string
	tier     int
	score    float64
	isArtist bool
	source   string
	reason   string
}

type searchJob struct {
	name string
	fn   func(context.Context, string, *SearchLogger) []TorrentResult
	arg  string
}

// ============================================================================
// 2. ДВОЙНОЙ ЛОГГЕР (ЧЕЛОВЕЧЕСКИЙ ЛОГ ШАГОВ + ПОЛНЫЙ ТЕХНИЧЕСКИЙ ТРЕЙС)
// ============================================================================

type SearchLogger struct {
	mu        sync.Mutex
	cfg       EngineConfig
	reqID     string
	startTime time.Time
	simpleBuf strings.Builder
	traceBuf  strings.Builder
}

func newSearchLogger(rawQuery string, cfg EngineConfig) *SearchLogger {
	now := time.Now()
	l := &SearchLogger{
		cfg:       cfg,
		reqID:     fmt.Sprintf("%s-%03d", now.Format("15:04:05"), now.Nanosecond()/1e6),
		startTime: now,
	}
	l.Simple("================================================================================")
	l.Simple("🔎 НОВЫЙ ПОИСК [%s] | Ввод пользователя: «%s»", now.Format("2006-01-02 15:04:05.000"), rawQuery)
	l.Simple("⚙️ Настройки: профиль=%s, формат=%s, SoundCloud=%v, скрывать 0 сидов=%v, мин.порог=%.2f",
		cfg.Profile, cfg.FormatTag, cfg.EnableSoundCloud, cfg.HideZeroSeeds, cfg.MinFuzzyScore)

	l.Trace("================================================================================")
	l.Trace("[INIT] reqID=%s timestamp=%s rawQuery=%q", l.reqID, now.Format(time.RFC3339Nano), rawQuery)
	cfgJSON, _ := json.Marshal(cfg)
	l.Trace("[CONFIG] %s", string(cfgJSON))
	return l
}

func (l *SearchLogger) elapsed() string {
	ms := time.Since(l.startTime).Milliseconds()
	return fmt.Sprintf("+%4dмс", ms)
}

func (l *SearchLogger) Simple(format string, args ...interface{}) {
	if l == nil || l.cfg.DisableLogs || !l.cfg.EnableSimpleLog {
		return
	}
	msg := fmt.Sprintf(format, args...)
	l.mu.Lock()
	l.simpleBuf.WriteString(fmt.Sprintf("[%s | %s] %s\n", time.Now().Format("15:04:05"), l.elapsed(), msg))
	l.mu.Unlock()
}

func (l *SearchLogger) Trace(format string, args ...interface{}) {
	if l == nil || l.cfg.DisableLogs || !l.cfg.EnableTraceLog {
		return
	}
	msg := fmt.Sprintf(format, args...)
	l.mu.Lock()
	l.traceBuf.WriteString(fmt.Sprintf("[%s | %s] %s\n", time.Now().Format("15:04:05.000"), l.elapsed(), msg))
	l.mu.Unlock()
}

func (l *SearchLogger) Flush() {
	if l == nil || l.cfg.DisableLogs {
		return
	}
	l.mu.Lock()
	sOut := l.simpleBuf.String()
	tOut := l.traceBuf.String()
	l.mu.Unlock()

	appendDualLogWithConfig(sOut, tOut, l.cfg)
}

func resolveLogPaths(cfg EngineConfig) (string, string) {
	simplePath := strings.TrimSpace(cfg.SimpleLogPath)
	tracePath := strings.TrimSpace(cfg.TraceLogPath)

	if simplePath != "" && tracePath != "" {
		return simplePath, tracePath
	}

	var baseDir string
	if strings.TrimSpace(cfg.LogDir) != "" {
		baseDir = strings.TrimSpace(cfg.LogDir)
		_ = os.MkdirAll(baseDir, 0755)
	} else {
		candidates := []string{
			"/storage/emulated/0/scripts/JennyPlayer",
			"/data/data/org.test.jennyplayer/files",
			".",
		}
		for _, d := range candidates {
			if st, err := os.Stat(d); err == nil && st.IsDir() {
				baseDir = d
				break
			}
		}
		if baseDir == "" {
			baseDir = "."
		}
	}

	if simplePath == "" {
		simplePath = filepath.Join(baseDir, "omni_simple.log")
	}
	if tracePath == "" {
		tracePath = filepath.Join(baseDir, "omni_full_trace.log")
	}
	return simplePath, tracePath
}

func appendDualLogWithConfig(simpleMsg, traceMsg string, cfg EngineConfig) {
	if cfg.DisableLogs {
		return
	}
	logMu.Lock()
	defer logMu.Unlock()

	simplePath, tracePath := resolveLogPaths(cfg)

	if cfg.EnableSimpleLog && simpleMsg != "" {
		if dir := filepath.Dir(simplePath); dir != "" && dir != "." {
			_ = os.MkdirAll(dir, 0755)
		}
		if f, err := os.OpenFile(simplePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
			_, _ = f.Write([]byte(simpleMsg))
			_ = f.Close()
		}
	}
	if cfg.EnableTraceLog && traceMsg != "" {
		if dir := filepath.Dir(tracePath); dir != "" && dir != "." {
			_ = os.MkdirAll(dir, 0755)
		}
		if f, err := os.OpenFile(tracePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
			_, _ = f.Write([]byte(traceMsg))
			_ = f.Close()
		}
	}
}

// ============================================================================
// 3. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ, СЛОВАРИ И РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
// ============================================================================

var (
	configMu      sync.RWMutex
	defaultConfig = EngineConfig{
		TimeoutMs:        25000,
		PreferAudio:      true,
		Profile:          "audio",
		EnablePhonetic:   true,
		EnableCatalog:    true,
		EnableUDP:        true,
		EnableSoundCloud: true,
		EnableSeekerP2P:  true,
		FormatTag:        "all",
		Year:             "",
		ExactMatch:       false,
		HideZeroSeeds:    true,
		MinTwoSeeds:      false,
		MinFuzzyScore:    0.50,
		DisableLogs:      false,
		EnableSimpleLog:  true,
		EnableTraceLog:   true,
		LogDir:           "",
		SimpleLogPath:    "",
		TraceLogPath:     "",
	}

	logMu sync.Mutex

	rutorIPMu     sync.RWMutex
	cachedRutorIP = "193.46.255.29"
	rutorIPTime   time.Time

	scClientMu       sync.RWMutex
	cachedSCClientID string
	scClientTime     time.Time

	httpClient *http.Client

	udpTrackers = []string{
		"tracker.opentrackr.org:1337",
		"open.stealth.si:80",
		"exodus.desync.com:6969",
		"tracker.torrent.eu.org:451",
	}

	formatKeywordsMap = map[string][]string{
		"flac": {"flac", "lossless", "24bit", "hi-res"},
		"alac": {"alac", "m4a", "lossless"},
		"wav":  {"wav", "wave", "pcm", "lossless"},
		"mp3":  {"mp3", "320", "cbr", "vbr", "mpeg"},
		"m4a":  {"m4a", "aac", "alac", "itunes"},
		"aac":  {"aac", "m4a", "mp4"},
		"ogg":  {"ogg", "vorbis", "opus"},
	}

	// Регулярные выражения
	reBtih          = regexp.MustCompile(`(?i)btih:([a-f0-9]{40})`)
	reHTMLTags      = regexp.MustCompile(`<[^>]*>`)
	reVideoTrash    = regexp.MustCompile(`(?i)(web-?dl|web-?bl|webrip|bdrip|bdremux|brrip|hdrip|hdtv|dvdrip|dvd5|dvd9|satrip|tvrip|camrip|1080[pi]|720p|2160p|x264|x265|hevc|avc|blu-?ray|\bкпк\b|\bсезон\b|\bсерии\b|\bfb2\b|\bpdf\b|\brtf\b|\bepub\b|\bmobi\b|\bdjvu\b|\bdoc\b|pc\s+by|repack|\bapk\b|аудиокниг|радиоспектакл|видеокурс|курс\s+иллюзионист|полезных\s+привыч|нанопривыч|силовые\s+упражн|\[клип\]|видеоклип)`)
	reAudioMarkers  = regexp.MustCompile(`(?i)\b(flac|mp3|wav|lossless|alac|m4a|aac|ape|wv|ogg|opus|320\s*kbps|320kbps|24bit|16bit|hi-?res|discography|дискография|альбом|сборник|коллекция|collection|anthology|ost|soundtrack)\b`)
	reCollabMarkers = regexp.MustCompile(`(?i)(?:\b(feat\.?|ft\.?|feature|featuring|with|prod\.?\s*by|vs\.?|при\s*уч\.?|при\s*участии|уч\.?|совм\.?|совместно\s*с|tribute|трибьют|cover|кавер)\b|\s+&\s+)`)
	reNoiseWords    = regexp.MustCompile(`(?i)\b(music|lyrics|official|video|audio|hd|клип|слушать|текст|скачать|торрент)\b`)
	reHardJunk      = regexp.MustCompile(`(?i)(\bfitgirl\b|\brepack\b|pc\s*\||\s*pc\b|\(\d{4}\)\s*pc\b|\bdlc\b|\[v\s*\d+\.\d+|\bfb2\b|\bpdf\b|\brtf\b|\bepub\b|\bmobi\b|\bdjvu\b|аудиокниг|радиоспектакл|\[книг|\bкнига\s*\d|\bкниги\s*\d|\bтом\s*\d|vhsrip|dvdrip|dvdremux|bdremux|dbrip|hdrip|tvrip|видеоколлекц|anifilm|anidub|anilibria|кубик\s+в\s+кубе|iptv|satremux|50\s*fps|курс\s+иллюзионист|полезных\s+привыч|нанопривыч|силовые\s+упражн|pc\s+by)`)
	reBracketMeta   = regexp.MustCompile(`[\(\[\{][^\)\]\}]*[\)\]\}]`)

	// SoundCloud regexes (для авто-извлечения client_id и SSR __sc_hydration)
	reSCScriptURL = regexp.MustCompile(`https://a-v2\.sndcdn\.com/assets/[^\s"']+\.js`)
	reSCClientID  = regexp.MustCompile(`client_id\s*[:=]\s*["']([a-zA-Z0-9]{32})["']`)
	reSCHydration = regexp.MustCompile(`(?s)window\.__sc_hydration\s*=\s*(\[.*?\]);\s*</script>`)

	// Rutor regexes
	reRutorRow    = regexp.MustCompile(`(?s)<tr class="(?:gai|tum)">(.*?)</tr>`)
	reRutorMagnet = regexp.MustCompile(`(?i)href="(magnet:\?xt=urn:btih:([a-f0-9]{40})[^"]*)"`)
	reRutorTitle  = regexp.MustCompile(`(?s)<a[^>]+href="/torrent/[^"]+"[^>]*>(.*?)</a>`)
	reRutorSize   = regexp.MustCompile(`(?i)([0-9]+(?:[.,][0-9]+)?)\s*(GB|MB|KB|TB|ГБ|МБ|КБ|ТБ)`)
	reRutorSeeds  = regexp.MustCompile(`(?s)class="green"[^>]*>.*?([0-9]+)`)
	reRutorPeers  = regexp.MustCompile(`(?s)class="red"[^>]*>.*?([0-9]+)`)

	// BitSearch regexes
	reBitItem   = regexp.MustCompile(`(?is)<li\s+class="[^"]*search-result[^"]*">`)
	reBitMagnet = regexp.MustCompile(`(?i)href=["'](magnet:\?xt=urn:btih:([a-f0-9]{40})[^"']*)["']`)
	reBitTitle1 = regexp.MustCompile(`(?s)class="title[^"]*"[^>]*>\s*<a[^>]*>(.*?)</a>`)
	reBitTitle2 = regexp.MustCompile(`(?is)<h5\s+class="title[^"]*">.*?<a[^>]*>(.*?)</a>`)
	reBitSize1  = regexp.MustCompile(`(?i)([0-9]+(?:[.,][0-9]+)?)\s*(GB|MB|KB)`)
	reBitSize2  = regexp.MustCompile(`(?is)alt="Size"[^>]*>\s*([0-9.,]+)\s*(B|KB|MB|GB|TB)`)
	reBitSeeds1 = regexp.MustCompile(`(?i)(?:color:\s*#039e03|text-green)[^>]*>\s*([0-9,]+)`)
	reBitSeeds2 = regexp.MustCompile(`(?is)alt="Seeder"[^>]*>.*?(\d[\d,]*)`)
	reBitPeers  = regexp.MustCompile(`(?is)alt="Leecher"[^>]*>.*?(\d[\d,]*)`)

	normReplacer = strings.NewReplacer(
		"Ÿ", "Y", "ÿ", "y", "Ö", "O", "ö", "o", "Ü", "U", "ü", "u", "Ä", "A", "ä", "a",
		"‐", "-", "‑", "-", "–", "-", "—", "-", "’", "-", "`", "-", "'", "-",
	)

	phoneticReplacer = strings.NewReplacer(
		"уа", "va", "уэ", "ve", "уе", "ve", "уи", "vi", "уо", "vo", "шн", "sn", "шен", "sn", "шин", "sn", "жн", "sn", "жен", "sn", "чер", "cr", "чур", "cr", "дж", "j", "tion", "sn", "sion", "sn", "ture", "cr", "ght", "t", "kn", "n", "wr", "r", "wh", "v", "th", "t", "shch", "s", "sch", "s", "sht", "st", "shp", "sp", "sh", "s",
		"tch", "c", "ch", "c", "ts", "c", "tz", "c", "zh", "s",
		"dge", "j", "dzh", "j", "dj", "j", "gy", "j", "gi", "j", "ge", "j",
		"ce", "s", "ci", "s", "cy", "s", "kh", "h", "ph", "f", "ck", "k", "qu", "kv", "c", "k", "q", "k",
		"x", "ks", "w", "v", "b", "p", "d", "t", "g", "k", "z", "s", "v", "f",
		"a", "", "e", "", "i", "", "o", "", "u", "", "y", "", "h", "",
	)

	kbdEnToRu = strings.NewReplacer(
		"q", "й", "w", "ц", "e", "у", "r", "к", "t", "е", "y", "н", "u", "г", "i", "ш", "o", "щ", "p", "з", "[", "х", "]", "ъ",
		"a", "ф", "s", "ы", "d", "в", "f", "а", "g", "п", "h", "р", "j", "о", "k", "л", "l", "д", ";", "ж", "'", "э",
		"z", "я", "x", "ч", "c", "с", "v", "м", "b", "и", "n", "т", "m", "ь", ",", "б", ".", "ю",
	)

	kbdRuToEn = strings.NewReplacer(
		"й", "q", "ц", "w", "у", "e", "к", "r", "е", "t", "н", "y", "г", "u", "ш", "i", "щ", "o", "з", "p", "х", "[", "ъ", "]",
		"ф", "a", "ы", "s", "в", "d", "а", "f", "п", "g", "р", "h", "о", "j", "л", "k", "д", "l", "ж", ";", "э", "'",
		"я", "z", "ч", "x", "с", "c", "м", "v", "и", "b", "т", "n", "ь", "m", "б", ",", "ю", ".",
	)

	ruToEnStd = strings.NewReplacer(
		"щ", "shch", "ш", "sh", "ч", "ch", "ц", "ts", "ж", "zh", "х", "kh", "ё", "e", "ю", "yu", "я", "ya",
		"а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "i", "к", "k",
		"л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u", "ф", "f",
		"ъ", "", "ы", "y", "ь", "", "э", "e",
	)

	ruToEnAlt = strings.NewReplacer(
		"щ", "sch", "ш", "sh", "ч", "ch", "ц", "c", "ж", "j", "х", "h", "ё", "e", "ю", "u", "я", "ia",
		"а", "a", "б", "b", "в", "w", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "i", "к", "c",
		"л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u", "ф", "f",
		"ъ", "", "ы", "i", "ь", "", "э", "e",
	)

	ruToAngloReplacer = strings.NewReplacer(
		"дж", "j", "тч", "ch", "ч", "ch", "ш", "sh", "щ", "sh", "кс", "x", "кв", "qu", "кью", "cu", "ью", "u",
		"айт", "ight", "аунд", "ound", "аун", "own", "ей", "ey", "эй", "ay", "ай", "ai", "ой", "oy", "ау", "ou", "оу", "o", "я", "ya", "ю", "u",
		"а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "i", "к", "k",
		"л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u", "ф", "f",
		"х", "h", "ц", "ts", "ы", "y", "ъ", "", "ь", "",
	)

	ruToGermanicReplacer = strings.NewReplacer(
		"рамшт", "rammst", "раммшт", "rammst", "шт", "st", "шп", "sp", "шм", "schm", "шн", "schn", "шв", "schw", "шл", "schl", "штр", "str",
		"ай", "ei", "ей", "ei", "ой", "eu", "ау", "au", "х", "ch", "ц", "z", "к", "k", "в", "w", "ф", "v",
		"щ", "sch", "ш", "sch", "ч", "tsch", "ж", "sch", "ё", "oe", "ю", "ue", "я", "ja",
		"а", "a", "б", "b", "г", "g", "д", "d", "е", "e", "з", "s", "и", "i", "й", "j",
		"л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u",
		"ъ", "", "ы", "y", "ь", "", "э", "e",
	)

	spelledTokenMap = map[string][]string{
		"эй":     {"a"},
		"ей":     {"a"},
		"би":     {"b"},
		"си":     {"c"},
		"ди":     {"d"},
		"и":      {"e"},
		"эф":     {"f"},
		"джи":    {"g", "g-"},
		"эйч":    {"h"},
		"ай":     {"i"},
		"джей":   {"j", "jay"},
		"джэй":   {"j", "jay"},
		"кей":    {"k"},
		"кэй":    {"k"},
		"эл":     {"l", "el"},
		"эм":     {"m"},
		"эн":     {"n"},
		"оу":     {"o"},
		"пи":     {"p"},
		"кью":    {"q"},
		"ар":     {"r"},
		"эс":     {"s"},
		"ти":     {"t"},
		"ю":      {"u"},
		"ви":     {"v"},
		"даблю":  {"w"},
		"дабл-ю": {"w"},
		"экс":    {"x"},
		"икс":    {"x"},
		"вай":    {"y"},
		"уай":    {"y"},
		"зет":    {"z"},
		"зэт":    {"z"},
		"зи":     {"z", "zee"},
		"зе":     {"z", "the"},
		"зэ":     {"the"},
		"диджей": {"dj"},
		"эмси":   {"mc"},
		"ту":     {"2", "two"},
		"пак":    {"pac"},
	}

	// Чистые языковые числительные и служебные сокращения (без хардкода имён артистов или песен)
	spokenWordEquiv = map[string]string{
		"доктор": "dr", "doctor": "dr", "др": "dr",
		"фифти": "50", "fifty": "50",
		"туенти": "twenty", "твенти": "twenty",
		"уан": "one", "ван": "one",
		"энд": "and", "эн": "and", "n": "and",
	}

	// Единая таблица одиночных букв алфавита (для склейки аббревиатур вида "эй си ди си" <-> "AC/DC", "ди эм икс" <-> "DMX", "D.R.E." <-> "дре")
	alphabetLetterMap = map[string]string{
		"эй": "a", "ей": "a", "a": "a",
		"би": "b", "b": "b",
		"си": "c", "c": "c",
		"ди": "d", "d": "d",
		"и": "e", "e": "e",
		"эф": "f", "f": "f",
		"джи": "g", "g": "g",
		"эйч": "h", "h": "h",
		"ай": "i", "i": "i",
		"джей": "j", "джэй": "j", "jay": "j", "j": "j",
		"кей": "k", "кэй": "k", "k": "k",
		"эл": "l", "l": "l",
		"эм": "m", "m": "m",
		"эн": "n", "n": "n",
		"оу": "o", "o": "o",
		"пи": "p", "p": "p",
		"кью": "q", "q": "q",
		"ар": "r", "r": "r",
		"эс": "s", "s": "s",
		"ти": "t", "t": "t",
		"ю": "u", "u": "u",
		"ви": "v", "v": "v",
		"даблю": "w", "дабл-ю": "w", "w": "w",
		"экс": "x", "икс": "x", "x": "x",
		"вай": "y", "уай": "y", "y": "y",
		"зет": "z", "зэт": "z", "зи": "z", "зе": "z", "z": "z",
	}

	knownPhoneticPhrases = map[string][]string{}

	// Обратная таблица транслитерации Латиница -> Кириллица (когда русского артиста/песню пишут латиницей: "vitya ak", "korol i shut")
	enToRuReplacer = strings.NewReplacer(
		"shch", "щ", "sch", "щ", "sht", "шт", "zh", "ж", "kh", "х", "ts", "ц", "tz", "ц", "tch", "ч", "ch", "ч", "sh", "ш",
		"yu", "ю", "ya", "я", "yo", "ё", "ye", "е", "yi", "й", "iy", "ий", "yy", "ый", "oy", "ой", "ay", "ай", "ey", "ей",
		"oo", "у", "ee", "и", "ea", "и", "ck", "к", "ph", "ф", "th", "т", "qu", "кв",
		"a", "а", "b", "б", "v", "в", "w", "в", "g", "г", "d", "д", "e", "е", "z", "з", "i", "и", "j", "дж",
		"k", "к", "c", "к", "q", "к", "l", "л", "m", "м", "n", "н", "o", "о", "p", "п", "r", "р", "s", "с",
		"t", "т", "u", "у", "f", "ф", "h", "х", "x", "кс", "y", "ы",
	)
)

func init() {
	if v := strings.TrimSpace(os.Getenv("OMNI_DISABLE_LOGS")); v == "1" || strings.EqualFold(v, "true") {
		defaultConfig.DisableLogs = true
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_SIMPLE_LOG")); v != "" {
		defaultConfig.EnableSimpleLog = (v == "1" || strings.EqualFold(v, "true"))
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_TRACE_LOG")); v != "" {
		defaultConfig.EnableTraceLog = (v == "1" || strings.EqualFold(v, "true"))
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_LOG_DIR")); v != "" {
		defaultConfig.LogDir = v
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_SIMPLE_LOG_PATH")); v != "" {
		defaultConfig.SimpleLogPath = v
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_TRACE_LOG_PATH")); v != "" {
		defaultConfig.TraceLogPath = v
	}
	if v := strings.TrimSpace(os.Getenv("OMNI_SC_CLIENT_ID")); v != "" {
		defaultConfig.SoundCloudClientID = v
	}

	dialer := &net.Dialer{
		Timeout:   6 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 32,
		IdleConnTimeout:     60 * time.Second,
		TLSHandshakeTimeout: 6 * time.Second,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err == nil && strings.Contains(host, "rutor.") {
				ip := resolveRutorIP(nil)
				if strings.IndexByte(ip, ':') >= 0 {
					addr = "[" + ip + "]:" + port
				} else {
					addr = ip + ":" + port
				}
			}
			return dialer.DialContext(ctx, network, addr)
		},
	}
	httpClient = &http.Client{
		Transport: transport,
		Timeout:   0,
	}
}

// ============================================================================
// 4. ФОНЕТИКА, ДИФТОНГИ, ТРАНСЛИТЕРАЦИЯ И УМНЫЙ РАЗБОР ДВУСЛОЖНЫХ ИМЕН
// ============================================================================

func hasCyrillic(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Cyrillic, r) {
			return true
		}
	}
	return false
}

func hasVowels(s string) bool {
	const vowels = "аеёиоуыэюяaeiouy"
	for _, r := range strings.ToLower(s) {
		if strings.ContainsRune(vowels, r) {
			return true
		}
	}
	return false
}

func normalizeCompact(s string) string {
	s = normReplacer.Replace(s)
	s = strings.ToLower(s)
	var out []rune
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			out = append(out, r)
		}
	}
	return string(out)
}

func compactRawLetters(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "ё", "е")
	var out []rune
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			out = append(out, r)
		}
	}
	return string(out)
}

func stripLeadingArticle(s string) string {
	s = strings.TrimSpace(s)
	lower := strings.ToLower(s)
	for _, art := range []string{"the ", "die ", "der ", "das "} {
		if strings.HasPrefix(lower, art) && len(s) > len(art) {
			return strings.TrimSpace(s[len(art):])
		}
	}
	return s
}

func phoneticSkeleton(s string) string {
	s = stripLeadingArticle(strings.ToLower(normReplacer.Replace(s)))
	s = strings.ReplaceAll(s, "ё", "е")
	if strings.HasPrefix(s, "kn") && len(s) > 2 {
		s = "n" + s[2:]
	} else if strings.HasPrefix(s, "wr") && len(s) > 2 {
		s = "r" + s[2:]
	}
	s = ruPreSoftReplacer.Replace(s)
	s = ruToLatCleanReplacer.Replace(s)
	s = skelSinglePassReplacer.Replace(s)
	var out []rune
	var last rune
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if r != last {
				out = append(out, r)
				last = r
			}
		}
	}
	return string(out)
}

func makeTrigrams(s string) map[string]struct{} {
	padded := "  " + s + " "
	runes := []rune(padded)
	res := make(map[string]struct{})
	for i := 0; i+3 <= len(runes); i++ {
		res[string(runes[i:i+3])] = struct{}{}
	}
	return res
}

func trigramSimilarity(a, b string) float64 {
	if a == "" || b == "" {
		return 0
	}
	ta := makeTrigrams(a)
	tb := makeTrigrams(b)
	inter := 0
	for k := range ta {
		if _, ok := tb[k]; ok {
			inter++
		}
	}
	union := len(ta) + len(tb) - inter
	if union == 0 {
		return 1.0
	}
	return float64(inter) / float64(union)
}

func damerauLevenshtein(a, b string) int {
	ra := []rune(a)
	rb := []rune(b)
	la, lb := len(ra), len(rb)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}
	d := make([][]int, la+1)
	for i := range d {
		d[i] = make([]int, lb+1)
		d[i][0] = i
	}
	for j := 0; j <= lb; j++ {
		d[0][j] = j
	}
	for i := 1; i <= la; i++ {
		for j := 1; j <= lb; j++ {
			cost := 0
			if ra[i-1] != rb[j-1] {
				cost = 1
			}
			v := d[i-1][j] + 1
			if d[i][j-1]+1 < v {
				v = d[i][j-1] + 1
			}
			if d[i-1][j-1]+cost < v {
				v = d[i-1][j-1] + cost
			}
			if i > 1 && j > 1 && ra[i-1] == rb[j-2] && ra[i-2] == rb[j-1] {
				if d[i-2][j-2]+1 < v {
					v = d[i-2][j-2] + 1
				}
			}
			d[i][j] = v
		}
	}
	return d[la][lb]
}

func decodeSpelledLetters(s string, logger *SearchLogger) []string {
	clean := strings.Join(strings.Fields(strings.ToLower(normReplacer.Replace(s))), " ")
	var results []string
	add := func(val, why string) {
		val = strings.TrimSpace(val)
		if val == "" {
			return
		}
		for _, ex := range results {
			if strings.EqualFold(ex, val) {
				return
			}
		}
		results = append(results, val)
		if logger != nil {
			logger.Simple("🔤 Функция decodeSpelledLetters: «%s» -> «%s» (%s)", s, val, why)
			logger.Trace("[decodeSpelledLetters] input=%q -> output=%q reason=%s", s, val, why)
		}
	}

	for _, seg := range segmentSpacelessSpelled(clean) {
		add(seg, "алгоритмический разбор букв алфавита")
	}
	if known, ok := knownPhoneticPhrases[clean]; ok {
		for _, k := range known {
			add(k, "словарь известных фонетических имён")
		}
	}

	tokens := strings.FieldsFunc(clean, func(r rune) bool {
		return unicode.IsSpace(r) || r == '-'
	})
	if len(tokens) >= 2 {
		allSpelled := true
		var primaryParts []string
		var altParts []string
		for _, tok := range tokens {
			if variants, ok := spelledTokenMap[tok]; ok {
				primaryParts = append(primaryParts, variants[0])
				if len(variants) > 1 {
					altParts = append(altParts, variants[1])
				} else {
					altParts = append(altParts, variants[0])
				}
			} else {
				allSpelled = false
				break
			}
		}
		if allSpelled {
			add(strings.ToUpper(strings.Join(primaryParts, "")), "склейка русских названий букв")
			add(strings.ToUpper(strings.Join(primaryParts, "-")), "склейка русских названий букв через дефис")
			add(strings.Join(altParts, " "), "раздельная расшифровка слогов")
			add(strings.Join(altParts, "-"), "расшифровка слогов через дефис")
		} else if firstVars, ok := spelledTokenMap[tokens[0]]; ok {
			restAnglo := ruToAngloReplacer.Replace(strings.Join(tokens[1:], " "))
			for _, fv := range firstVars {
				add(fv+" "+restAnglo, "расшифровка первого слога-префикса «"+tokens[0]+"»")
				add(fv+"-"+restAnglo, "расшифровка первого слога-префикса через дефис")
			}
		}
	}

	return results
}

var singleConsonantEn = map[rune]string{
	'б': "b", 'в': "v", 'г': "g", 'д': "d", 'з': "z", 'к': "k", 'л': "l",
	'м': "m", 'н': "n", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'ф': "f",
}

var ruPreSoftReplacer = strings.NewReplacer(
	"уай", "wi", "уэй", "wa", "уор", "wor", "уэ", "we", "уо", "wo", "уи", "wi", "уа", "wa",
	"шн", "shn", "шен", "shn", "шин", "shn", "жн", "shn", "жен", "shn", "чер", "chr", "чур", "chr",
	"айт", "it", "ай", "i", "ей", "i", "эй", "i", "оу", "o", "ау", "o", "ой", "oi", "ью", "u", "ю", "u",
	"ёр", "ur", "ер", "ur", "шт", "st", "шп", "sp", "дж", "j",
)

var ruToLatCleanReplacer = strings.NewReplacer(
	"щ", "shch", "ш", "sh", "ч", "ch", "ц", "ts", "ж", "zh", "х", "h", "ё", "e", "ю", "yu", "я", "ya",
	"а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "y", "к", "k",
	"л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u", "ф", "f",
	"ъ", "", "ы", "y", "ь", "", "э", "e",
)

var skelSinglePassReplacer = strings.NewReplacer(
	"shch", "s", "sch", "s", "sht", "st", "shp", "sp", "sh", "s", "zh", "s",
	"tch", "c", "ch", "c", "ts", "s", "tz", "s",
	"dge", "j", "dzh", "j", "dj", "j", "ggy", "g", "gy", "j", "ge", "j", "gi", "j",
	"tion", "sn", "sion", "sn", "ture", "cr",
	"ght", "t", "wh", "f", "th", "t", "ph", "f", "kh", "",
	"ce", "s", "ci", "s", "cy", "s", "ck", "k", "qu", "kf",
	"c", "k", "q", "k", "g", "k", "x", "ks",
	"w", "f", "v", "f", "b", "p", "d", "t", "z", "s",
	"a", "", "e", "", "i", "", "o", "", "u", "", "y", "", "h", "",
)

var latSoftSinglePassReplacer = strings.NewReplacer(
	"tion", "sn", "sion", "sn", "ture", "cr",
	"ight", "it", "igh", "i", "ght", "t",
	"dge", "j", "dzh", "j", "dj", "j", "gy", "j",
	"shch", "s", "sch", "s", "sht", "st", "shp", "sp", "sh", "s", "zh", "s",
	"tch", "c", "ch", "c", "ts", "s", "tz", "s",
	"ce", "s", "ci", "s", "cy", "s",
	"ck", "k", "qu", "kv", "ph", "f", "th", "s", "wh", "v", "kh", "h", "rh", "r", "john", "jon",
	"ai", "i", "ei", "i", "ay", "i", "ey", "i", "ea", "i", "ee", "i", "ie", "i",
	"oa", "o", "ow", "o", "ou", "o", "oo", "u", "ew", "u", "ue", "u", "yu", "u", "ya", "a",
	"ir", "ur", "er", "ur", "or", "ur",
	"w", "v", "c", "k", "q", "k", "x", "ks", "z", "s", "y", "i",
	"e", "i", "u", "a", "o", "a",
)

func phoneticSoftWord(w string) string {
	w = strings.ToLower(strings.TrimSpace(w))
	w = strings.ReplaceAll(w, "ё", "е")
	if eq, ok := spokenWordEquiv[w]; ok {
		w = eq
	}
	if strings.HasPrefix(w, "kn") && len(w) > 2 {
		w = "n" + w[2:]
	} else if strings.HasPrefix(w, "wr") && len(w) > 2 {
		w = "r" + w[2:]
	}
	w = ruPreSoftReplacer.Replace(w)
	w = ruToLatCleanReplacer.Replace(w)
	if len(w) > 2 && strings.HasSuffix(w, "e") {
		w = w[:len(w)-1]
	}
	w = latSoftSinglePassReplacer.Replace(w)
	var dedup []rune
	var last rune
	for _, r := range w {
		if (unicode.IsLetter(r) || unicode.IsDigit(r)) && r != last {
			dedup = append(dedup, r)
			last = r
		}
	}
	return string(dedup)
}

func normalizeSpelledTokens(tokens []string) []string {
	var out []string
	i := 0
	for i < len(tokens) {
		t := tokens[i]
		if eq, ok := spokenWordEquiv[t]; ok {
			t = eq
		}
		if _, isLet := alphabetLetterMap[t]; isLet {
			var run []string
			j := i
			for j < len(tokens) {
				if l, ok := alphabetLetterMap[tokens[j]]; ok {
					run = append(run, l)
					j++
				} else {
					break
				}
			}
			if len(run) >= 2 {
				out = append(out, strings.Join(run, ""))
				i = j
				continue
			}
		}
		out = append(out, t)
		i++
	}
	return out
}

func phoneticSoftNorm(s string) string {
	s = stripLeadingArticle(strings.ToLower(normReplacer.Replace(s)))
	words := normalizeSpelledTokens(tokenize(s))
	var normWords []string
	for _, w := range words {
		normWords = append(normWords, phoneticSoftWord(w))
	}
	return strings.Join(normWords, "")
}

func segmentSpacelessSpelled(w string) []string {
	syllables := []struct{ ru, en string }{
		{"даблю", "W"}, {"джей", "J"}, {"джэй", "J"}, {"эйч", "H"}, {"кью", "Q"},
		{"экс", "X"}, {"икс", "X"}, {"вай", "Y"}, {"уай", "Y"}, {"зет", "Z"}, {"зэт", "Z"},
		{"джи", "G"}, {"эй", "A"}, {"ей", "A"}, {"би", "B"}, {"си", "C"}, {"ди", "D"},
		{"эф", "F"}, {"ай", "I"}, {"кей", "K"}, {"кэй", "K"}, {"эл", "L"}, {"эм", "M"},
		{"эн", "N"}, {"оу", "O"}, {"пи", "P"}, {"ар", "R"}, {"эс", "S"}, {"ти", "T"},
		{"ви", "V"}, {"зи", "Z"}, {"ю", "U"},
	}
	var parts []string
	rem := strings.ToLower(strings.TrimSpace(w))
	for len(rem) > 0 {
		matched := false
		for _, syl := range syllables {
			if strings.HasPrefix(rem, syl.ru) {
				parts = append(parts, syl.en)
				rem = rem[len(syl.ru):]
				matched = true
				break
			}
		}
		if !matched {
			return nil
		}
	}
	if len(parts) < 2 {
		return nil
	}
	joined := strings.Join(parts, "")
	out := []string{joined, strings.Join(parts, " ")}
	if len(parts) == 4 {
		out = append([]string{parts[0] + parts[1] + "/" + parts[2] + parts[3], parts[0] + parts[1] + " " + parts[2] + parts[3]}, out...)
	}
	return out
}

func contextualYotTranslitWord(w string) string {
	runes := []rune(strings.ToLower(w))
	var out []rune
	isV := func(r rune) bool { return strings.ContainsRune("аеёиоуыэюяaeiouy", r) }
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		if r == 'й' {
			atEnd := (i == len(runes)-1) || !unicode.IsLetter(runes[i+1])
			atStartBeforeV := (i == 0 || !unicode.IsLetter(runes[i-1])) && (i+1 < len(runes) && isV(runes[i+1]))
			if atEnd || atStartBeforeV {
				out = append(out, 'y')
			} else {
				out = append(out, 'i')
			}
			continue
		}
		out = append(out, r)
	}
	return ruToEnStd.Replace(string(out))
}

func transformWordDiphthongs(w string) []string {
	w = strings.ToLower(strings.TrimSpace(w))
	if w == "" {
		return nil
	}
	var out []string
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		for _, ex := range out {
			if strings.EqualFold(ex, s) {
				return
			}
		}
		out = append(out, s)
	}

	for _, sp := range segmentSpacelessSpelled(w) {
		add(sp)
	}

	endRules := []struct{ ruSuf, enSuf1, enSuf2 string }{
		{"джи", "gy", "dge"},
		{"дж", "dge", "ge"},
		{"айс", "ice", "is"},
		{"энс", "ance", "ence"},
		{"анс", "ance", "ans"},
		{"оуч", "oach", "ouch"},
		{"оуст", "oast", "ost"},
		{"оуд", "oad", "ode"},
		{"аунд", "ound", "aund"},
		{"аун", "own", "aun"},
		{"аус", "ouse", "aus"},
		{"аут", "out", "aut"},
		{"ауэр", "ower", "auer"},
		{"авер", "ower", "aver"},
		{"файр", "fire", "fair"},
		{"фаер", "fire", "faer"},
		{"айр", "ire", "air"},
		{"аер", "ire", "aer"},
		{"ейшн", "ation", "eishn"},
		{"эйшн", "ation", "aishn"},
		{"шн", "tion", "sion"},
		{"шен", "tion", "shen"},
		{"шин", "tion", "shin"},
		{"жн", "sion", "zhn"},
		{"жен", "sion", "zhen"},
		{"чер", "ture", "cher"},
		{"чур", "ture", "chur"},
		{"инг", "ing", "ing"},
		{"пл", "ple", "pl"},
		{"бл", "ble", "bl"},
		{"тл", "tle", "tl"},
		{"дл", "dle", "dl"},
		{"кл", "cle", "kl"},
		{"гл", "gle", "gl"},
	}

	baseStems := []string{w}

	internalRules := []struct{ pat, rep1, rep2, rep3 string }{
		{"уай", "whi", "wi", "wai"},
		{"уэй", "way", "wa", "wei"},
		{"уор", "wor", "war", "vor"},
		{"уэ", "we", "wa", "ve"},
		{"уо", "wo", "wa", "vo"},
		{"уи", "wi", "we", "vi"},
		{"айт", "ight", "it", "ite"},
		{"аунд", "ound", "und", "aund"},
		{"ауэр", "ower", "auer", "our"},
		{"файр", "fire", "fair", "fir"},
		{"фаер", "fire", "faer", "fir"},
		{"шт", "st", "sht", "scht"},
		{"шп", "sp", "shp", "schp"},
		{"ёр", "ur", "ir", "er"},
		{"ер", "ur", "er", "ir"},
		{"ау", "ou", "ow", "au"},
		{"ой", "oi", "oy", "oj"},
		{"эй", "a", "ai", "ea"},
		{"ей", "a", "ai", "ea"},
		{"ай", "i", "ai", "ei"},
		{"оу", "o", "oa", "ow"},
		{"ью", "u", "ew", "yu"},
		{"эк", "ack", "ac", "ek"},
		{"эш", "ash", "esh", "ash"},
		{"энд", "and", "end", "ind"},
		{"эн", "an", "en", "in"},
		{"э", "a", "e", "i"},
	}

	for _, ir := range internalRules {
		if strings.Contains(w, ir.pat) {
			baseStems = append(baseStems,
				strings.ReplaceAll(w, ir.pat, ir.rep1),
				strings.ReplaceAll(w, ir.pat, ir.rep2),
				strings.ReplaceAll(w, ir.pat, ir.rep3),
			)
		}
	}

	if len([]rune(w)) >= 3 && len([]rune(w)) <= 6 {
		if strings.Contains(w, "и") {
			baseStems = append(baseStems, strings.Replace(w, "и", "ee", 1), strings.Replace(w, "и", "ea", 1))
		}
		if strings.Contains(w, "у") && !strings.Contains(w, "ау") && !strings.Contains(w, "оу") {
			baseStems = append(baseStems, strings.Replace(w, "у", "oo", 1))
		}
	}

	for _, stem := range baseStems {
		for _, er := range endRules {
			if strings.HasSuffix(stem, er.ruSuf) && len(stem) > len(er.ruSuf) {
				pref := contextualYotTranslitWord(stem[:len(stem)-len(er.ruSuf)])
				add(pref + er.enSuf1)
				if er.enSuf2 != er.enSuf1 {
					add(pref + er.enSuf2)
				}
			}
		}

		for _, dp := range []struct{ ruDip, vowel, altDigraph string }{
			{"ай", "i", "ai"},
			{"ей", "a", "ai"},
			{"эй", "a", "ai"},
			{"оу", "o", "oa"},
			{"ью", "u", "ew"},
			{"ю", "u", "ew"},
		} {
			idx := strings.LastIndex(stem, dp.ruDip)
			if idx >= 0 {
				after := []rune(stem[idx+len(dp.ruDip):])
				before := stem[:idx]
				beforeEn := contextualYotTranslitWord(before)
				if len(after) == 0 {
					switch dp.ruDip {
					case "ай":
						add(beforeEn + "y")
						add(beforeEn + "i")
						add(beforeEn + "igh")
						add(beforeEn + "ie")
					case "ей", "эй":
						add(beforeEn + "ay")
						add(beforeEn + "ey")
						add(beforeEn + "a")
					case "оу":
						add(beforeEn + "ow")
						add(beforeEn + "o")
					case "ью", "ю":
						add(beforeEn + "ew")
						add(beforeEn + "ue")
						add(beforeEn + "u")
					}
				} else if len(after) == 1 {
					if cEn, ok := singleConsonantEn[after[0]]; ok {
						if after[0] == 'с' && (dp.ruDip == "ай" || dp.ruDip == "ей" || dp.ruDip == "эй") {
							add(beforeEn + dp.vowel + "ce")
						}
						if dp.ruDip == "ай" && (after[0] == 'н' || after[0] == 'м') {
							germB := ruToGermanicReplacer.Replace(before)
							if strings.Contains(germB, "mst") && !strings.Contains(germB, "mmst") {
								add(strings.ReplaceAll(germB, "mst", "mmst") + "ei" + cEn)
							}
							add(germB + "ei" + cEn)
						}
						add(beforeEn + dp.vowel + cEn + "e")
						add(beforeEn + dp.vowel + cEn)
						add(beforeEn + dp.altDigraph + cEn)
						if (dp.ruDip == "ей" || dp.ruDip == "эй") && after[0] == 'к' {
							add(beforeEn + "eak")
						}
					}
				}
			}
		}

		germ := ruToGermanicReplacer.Replace(stem)
		if strings.Contains(germ, "mst") && !strings.Contains(germ, "mmst") {
			add(strings.ReplaceAll(germ, "mst", "mmst"))
		}
		add(germ)
		add(contextualYotTranslitWord(stem))
	}

	var orthoVars []string
	for _, item := range out {
		low := strings.ToLower(item)
		if strings.HasPrefix(low, "k") && len(low) >= 3 {
			sec := low[1]
			if sec == 'a' || sec == 'o' || sec == 'u' || sec == 'l' || sec == 'r' {
				orthoVars = append(orthoVars, "c"+item[1:])
			}
		}
		if strings.HasPrefix(low, "kv") && len(low) >= 3 {
			orthoVars = append(orthoVars, "qu"+item[2:])
		}
		if strings.Contains(low, "v") {
			orthoVars = append(orthoVars, strings.ReplaceAll(low, "v", "w"))
		}
	}
	out = append(orthoVars, out...)
	var dedupOut []string
	for _, item := range out {
		exists := false
		for _, ex := range dedupOut {
			if strings.EqualFold(ex, item) {
				exists = true
				break
			}
		}
		if !exists && item != "" {
			dedupOut = append(dedupOut, item)
		}
	}
	out = dedupOut
	if len(out) > 12 {
		out = out[:12]
	}
	return out
}

func expandRussianDiphthongsAndPhonetics(phrase string) []string {
	words := strings.Fields(strings.ToLower(strings.TrimSpace(phrase)))
	if len(words) == 0 {
		return nil
	}
	if len(words) == 1 {
		return transformWordDiphthongs(words[0])
	}
	wordVars := make([][]string, len(words))
	for i, w := range words {
		vars := transformWordDiphthongs(w)
		if len(vars) > 4 {
			vars = vars[:4]
		}
		if len(vars) == 0 {
			vars = []string{contextualYotTranslitWord(w)}
		}
		wordVars[i] = vars
	}
	var results []string
	addPhrase := func(p string) {
		p = strings.Join(strings.Fields(strings.TrimSpace(p)), " ")
		if p == "" {
			return
		}
		for _, ex := range results {
			if strings.EqualFold(ex, p) {
				return
			}
		}
		results = append(results, p)
	}
	for i0 := 0; i0 < len(wordVars[0]) && i0 < 3; i0++ {
		if len(words) == 2 {
			for i1 := 0; i1 < len(wordVars[1]) && i1 < 3; i1++ {
				addPhrase(wordVars[0][i0] + " " + wordVars[1][i1])
			}
		} else {
			var row []string
			for wIdx := range words {
				idx := 0
				if i0 < len(wordVars[wIdx]) {
					idx = i0
				}
				row = append(row, wordVars[wIdx][idx])
			}
			addPhrase(strings.Join(row, " "))
		}
	}
	return results
}

func fetchCascadingGoogleSuggest(ctx context.Context, rawQuery string, phoneticDrafts []string, logger *SearchLogger) []string {
	var results []string
	var mu sync.Mutex
	addRes := func(s string) {
		s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
		if s == "" {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		for _, ex := range results {
			if strings.EqualFold(ex, s) {
				return
			}
		}
		results = append(results, s)
	}

	probesStep1 := []struct{ q, hl string }{{rawQuery, "ru"}, {rawQuery, "en"}}
	for i := 0; i < len(phoneticDrafts) && i < 4; i++ {
		probesStep1 = append(probesStep1, struct{ q, hl string }{phoneticDrafts[i], "en"})
	}

	var step1Hits []string
	var s1Mu sync.Mutex
	var wg1 sync.WaitGroup
	for _, p := range probesStep1 {
		wg1.Add(1)
		go func(q, hl string) {
			defer wg1.Done()
			sug := fetchGoogleSuggest(ctx, q, hl, logger)
			if sug != "" && matchWithinTwoLettersNoSymbols(sug, rawQuery) {
				addRes(sug)
				s1Mu.Lock()
				step1Hits = append(step1Hits, sug)
				s1Mu.Unlock()
			}
		}(p.q, p.hl)
	}
	wg1.Wait()

	var probesStep2 []string
	seenS2 := make(map[string]bool)
	for _, h := range step1Hits {
		if hasCyrillic(h) {
			for _, dv := range expandRussianDiphthongsAndPhonetics(h) {
				if !seenS2[strings.ToLower(dv)] && len(probesStep2) < 4 {
					seenS2[strings.ToLower(dv)] = true
					probesStep2 = append(probesStep2, dv)
				}
			}
		} else if !strings.EqualFold(h, rawQuery) {
			key := strings.ToLower(h)
			if !seenS2[key] && len(probesStep2) < 4 {
				seenS2[key] = true
				probesStep2 = append(probesStep2, h)
			}
		}
	}

	if len(probesStep2) > 0 {
		var wg2 sync.WaitGroup
		for _, p2 := range probesStep2 {
			wg2.Add(1)
			go func(q2 string) {
				defer wg2.Done()
				sug2 := fetchGoogleSuggest(ctx, q2, "en", logger)
				if sug2 != "" && matchWithinTwoLettersNoSymbols(sug2, rawQuery) {
					logger.Simple("🔁 Каскад Google Suggest [Шаг 2]: черновик «%s» -> финальное исправление «%s»", q2, sug2)
					addRes(sug2)
				}
			}(p2)
		}
		wg2.Wait()
	}

	return results
}

func ruAngloPhoneticVariants(s string, logger *SearchLogger) []string {
	s = strings.TrimSpace(strings.ToLower(s))
	var out []string
	add := func(v, tag string) {
		v = strings.Join(strings.Fields(strings.TrimSpace(v)), " ")
		if v == "" || strings.EqualFold(v, s) {
			return
		}
		for _, ex := range out {
			if strings.EqualFold(ex, v) {
				return
			}
		}
		out = append(out, v)
		if logger != nil {
			logger.Trace("[ruAngloPhoneticVariants] src=%q -> variant=%q (%s)", s, v, tag)
		}
	}

	for _, sp := range decodeSpelledLetters(s, logger) {
		add(sp, "spelled_letters")
	}

	if hasCyrillic(s) {
		for _, dv := range expandRussianDiphthongsAndPhonetics(s) {
			add(dv, "pure_diphthong_rules")
		}
		germ := contextualYotTranslitWord(s)
		add(germ, "germanic_phonetic")
		if strings.Contains(s, "рамшт") && !strings.Contains(germ, "rammst") {
			add(strings.ReplaceAll(germ, "ramst", "rammst"), "double_m_germanic")
		}

		add(ruToAngloReplacer.Replace(s), "anglo_phonetic")
		add(contextualYotTranslitWord(s), "contextual_translit")
		add(ruToEnAlt.Replace(s), "alt_translit")
	} else {
		// Обратная транслитерация (Латиница -> Кириллица): если пользователь ввёл "vitya ak", "korol i shut", "gruppa krovi" или "rammstein" латиницей
		cyr1 := enToRuReplacer.Replace(s)
		add(cyr1, "latin_to_cyrillic_std")
		cyr2 := strings.ReplaceAll(cyr1, "ы", "и")
		add(cyr2, "latin_to_cyrillic_soft_i")
		cyr3 := strings.ReplaceAll(cyr1, "ы", "й")
		add(cyr3, "latin_to_cyrillic_yot")
		if known, ok := knownPhoneticPhrases[cyr1]; ok {
			for _, kv := range known {
				add(kv, "known_from_cyrillic_reverse")
			}
		}
		if known, ok := knownPhoneticPhrases[cyr2]; ok {
			for _, kv := range known {
				add(kv, "known_from_cyrillic_reverse")
			}
		}
	}

	if logger != nil && len(out) > 0 {
		logger.Simple("🗣️ Функция ruAngloPhoneticVariants: из «%s» построены фонетические варианты: %v", s, out)
	}
	return out
}

func matchStringsIR(a, b string) bool {
	a = stripLeadingArticle(strings.ToLower(strings.TrimSpace(a)))
	b = stripLeadingArticle(strings.ToLower(strings.TrimSpace(b)))
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true
	}
	sa, sb := phoneticSoftWord(a), phoneticSoftWord(b)
	if sa != "" && sa == sb {
		return true
	}
	// Числовой префикс "2" <-> "ту"/"two"/"to" (например, "2pac" <-> "тупак")
	if strings.HasPrefix(a, "2") || strings.HasPrefix(b, "2") {
		a2 := a
		b2 := b
		for _, pref := range []string{"ту", "two", "too", "to"} {
			if strings.HasPrefix(a2, pref) {
				a2 = "2" + a2[len(pref):]
				break
			}
			if strings.HasPrefix(b2, pref) {
				b2 = "2" + b2[len(pref):]
				break
			}
		}
		if phoneticSoftWord(a2) == phoneticSoftWord(b2) {
			return true
		}
	}

	pa, pb := phoneticSkeleton(a), phoneticSkeleton(b)
	paTh := phoneticSkeleton(strings.ReplaceAll(a, "th", "s"))
	pbTh := phoneticSkeleton(strings.ReplaceAll(b, "th", "s"))
	sdl := damerauLevenshtein(sa, sb)
	skDl := damerauLevenshtein(pa, pb)
	if thDl := damerauLevenshtein(paTh, pbTh); thDl < skDl {
		skDl = thDl
	}
	if skDl == 0 && sdl <= 2 {
		return true
	}
	if len(sa) >= 3 && len(sb) >= 3 && sdl <= 1 && skDl <= 1 {
		return true
	}
	if len(sa) >= 5 && len(sb) >= 5 && sdl <= 2 && skDl <= 1 {
		return true
	}
	if len(pa) >= 4 && len(pb) >= 4 && skDl <= 1 && sdl <= 3 {
		return true
	}
	return false
}

func tokenize(s string) []string {
	s = normReplacer.Replace(strings.ToLower(s))
	return strings.FieldsFunc(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

func matchWithinTwoLettersNoSymbols(a, b string) bool {
	ta := tokenize(stripLeadingArticle(strings.ToLower(a)))
	tb := tokenize(stripLeadingArticle(strings.ToLower(b)))
	if len(ta) == 0 || len(tb) == 0 {
		return false
	}
	if len(ta) == len(tb) {
		allMatch := true
		for i := range ta {
			if !matchStringsIR(ta[i], tb[i]) {
				allMatch = false
				break
			}
		}
		if allMatch {
			return true
		}
	}
	na := normalizeSpelledTokens(ta)
	nb := normalizeSpelledTokens(tb)
	if len(na) == len(nb) {
		allMatch := true
		for i := range na {
			if !matchStringsIR(na[i], nb[i]) {
				allMatch = false
				break
			}
		}
		if allMatch {
			return true
		}
	}
	// Сравнение слитной мягкой нормы и скелета для составных названий ("OneRepublic" <-> "уан репаблик", "AC/DC" <-> "эй си ди си", "Jay-Z" <-> "джэй зи")
	var saParts, sbParts []string
	for _, t := range na {
		saParts = append(saParts, phoneticSoftWord(t))
	}
	for _, t := range nb {
		sbParts = append(sbParts, phoneticSoftWord(t))
	}
	ja := strings.Join(saParts, "")
	jb := strings.Join(sbParts, "")
	if ja != "" && (ja == jb || (len(ja) >= 4 && damerauLevenshtein(ja, jb) <= 1)) {
		return true
	}
	jpa := phoneticSkeleton(strings.Join(na, ""))
	jpb := phoneticSkeleton(strings.Join(nb, ""))
	if len(jpa) >= 3 && jpa == jpb && damerauLevenshtein(ja, jb) <= 2 {
		return true
	}
	return false
}

func splitTorrentArtistAndRest(title string) (string, string) {
	cleaned := reBracketMeta.ReplaceAllString(title, " ")
	for _, sep := range []string{" - ", " – ", " — ", " / "} {
		if idx := strings.Index(cleaned, sep); idx > 0 {
			artist := strings.TrimSpace(cleaned[:idx])
			rest := strings.TrimSpace(cleaned[idx+len(sep):])
			if artist != "" && rest != "" {
				return artist, rest
			}
		}
	}
	return "", cleaned
}

func positionalPriorityMultiplier(title, query string) float64 {
	artist, _ := splitTorrentArtistAndRest(title)
	if artist != "" && matchWithinTwoLettersNoSymbols(artist, query) {
		return 1.25
	}
	return 1.0
}

func bestTokenSimInField(qTok string, fieldToks []string) float64 {
	best := 0.0
	qp := phoneticSkeleton(qTok)
	qEn := normalizeCompact(ruToEnStd.Replace(qTok))
	qGerm := normalizeCompact(ruToGermanicReplacer.Replace(qTok))

	for _, ft := range fieldToks {
		if qTok == ft {
			return 1.0
		}
		if matchStringsIR(qTok, ft) {
			return 0.96
		}
		ftEn := normalizeCompact(ruToEnStd.Replace(ft))
		maxLen := math.Max(float64(len([]rune(qEn))), float64(len([]rune(ftEn))))
		if maxLen == 0 {
			continue
		}
		dl := float64(damerauLevenshtein(qEn, ftEn))
		if gdl := float64(damerauLevenshtein(qGerm, ftEn)); gdl < dl {
			dl = gdl
		}
		sim := 1.0 - dl/maxLen
		tsim := trigramSimilarity(qEn, ftEn)
		score := 0.6*sim + 0.4*tsim
		if qp != "" && len(qp) >= 2 && qp == phoneticSkeleton(ft) {
			score = math.Max(score, 0.88)
		}
		if score > best {
			best = score
		}
	}
	return best
}

func computeFuzzyScore(title, query string) float64 {
	qToks := tokenize(stripLeadingArticle(query))
	tToks := tokenize(title)
	if len(qToks) == 0 || len(tToks) == 0 {
		return 0
	}
	sum := 0.0
	for _, qt := range qToks {
		sum += bestTokenSimInField(qt, tToks)
	}
	base := sum / float64(len(qToks))
	return math.Min(1.0, base*positionalPriorityMultiplier(title, query))
}

// ============================================================================
// 5. ПРИОРИТЕТ №1: SOUNDCLOUD API v2 + SSR HYDRATION (ТРЕКИ, АЛЬБОМЫ, АРТИСТЫ)
// ============================================================================

type scTrackObject struct {
	Title             string `json:"title"`
	Genre             string `json:"genre"`
	PlaybackCount     int    `json:"playback_count"`
	LikesCount        int    `json:"likes_count"`
	User              struct {
		Username string `json:"username"`
		FullName string `json:"full_name"`
	} `json:"user"`
	PublisherMetadata struct {
		Artist       string `json:"artist"`
		AlbumTitle   string `json:"album_title"`
		ReleaseTitle string `json:"release_title"`
	} `json:"publisher_metadata"`
}

// resolveSoundCloudClientID автоматически добывает и кэширует рабочий client_id из веб-бандлов SoundCloud
func resolveSoundCloudClientID(ctx context.Context, cfg EngineConfig, logger *SearchLogger) string {
	if strings.TrimSpace(cfg.SoundCloudClientID) != "" {
		return strings.TrimSpace(cfg.SoundCloudClientID)
	}
	scClientMu.RLock()
	if cachedSCClientID != "" && time.Since(scClientTime) < 2*time.Hour {
		cid := cachedSCClientID
		scClientMu.RUnlock()
		return cid
	}
	scClientMu.RUnlock()

	t0 := time.Now()
	reqCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", "https://soundcloud.com", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[SoundCloud-ClientID] ERR fetching soundcloud.com: %v", err)
		return ""
	}
	bodyBytes, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	scripts := reSCScriptURL.FindAllString(string(bodyBytes), -1)
	if len(scripts) == 0 {
		return ""
	}
	// Проверяем последние 3 JS-бандла параллельно (client_id всегда лежит в одном из последних чанков)
	startIdx := len(scripts) - 3
	if startIdx < 0 {
		startIdx = 0
	}
	targetScripts := scripts[startIdx:]

	var foundID string
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, sURL := range targetScripts {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			r, err := http.NewRequestWithContext(reqCtx, "GET", u, nil)
			if err != nil {
				return
			}
			r.Header.Set("User-Agent", "Mozilla/5.0")
			res, err := httpClient.Do(r)
			if err != nil {
				return
			}
			b, _ := io.ReadAll(res.Body)
			res.Body.Close()
			if m := reSCClientID.FindStringSubmatch(string(b)); len(m) >= 2 {
				mu.Lock()
				if foundID == "" {
					foundID = m[1]
				}
				mu.Unlock()
			}
		}(sURL)
	}
	wg.Wait()

	if foundID != "" {
		scClientMu.Lock()
		cachedSCClientID = foundID
		scClientTime = time.Now()
		scClientMu.Unlock()
		logger.Simple("🔑 SoundCloud: автоматически получен свежий client_id (%s...) за %d мс", foundID[:8], time.Since(t0).Milliseconds())
		logger.Trace("[SoundCloud-ClientID] extracted client_id=%s in %dms", foundID, time.Since(t0).Milliseconds())
	}
	return foundID
}

// extractSCArtistTrackAlbum вытаскивает из трека SoundCloud чистого Исполнителя, Трек и Альбом
func extractSCArtistTrackAlbum(tr scTrackObject) (string, string, string) {
	artist := strings.TrimSpace(tr.PublisherMetadata.Artist)
	album := strings.TrimSpace(tr.PublisherMetadata.AlbumTitle)
	if album == "" {
		album = strings.TrimSpace(tr.PublisherMetadata.ReleaseTitle)
	}
	trackTitle := strings.TrimSpace(reNoiseWords.ReplaceAllString(tr.Title, ""))

	// Если в заголовке трека на SoundCloud написано "Исполнитель - Название трека"
	splitArt, splitTrk := splitTorrentArtistAndRest(tr.Title)
	if splitArt != "" && splitTrk != "" {
		if artist == "" {
			artist = splitArt
		}
		trackTitle = splitTrk
	}
	if artist == "" {
		artist = strings.TrimSpace(tr.User.Username)
	}
	trackTitle = strings.TrimSpace(reBracketMeta.ReplaceAllString(trackTitle, ""))
	return artist, trackTitle, album
}

// fetchSoundCloudPriority — СТУПЕНЬ №1: ищет подсказки, треки, исполнителей и альбомы в SoundCloud
func fetchSoundCloudPriority(ctx context.Context, probes []string, rawQuery string, cfg EngineConfig, logger *SearchLogger) ([]catalogEntity, []ResolvedTrackInfo, string) {
	if !cfg.EnableSoundCloud {
		return nil, nil, ""
	}
	t0 := time.Now()
	clientID := resolveSoundCloudClientID(ctx, cfg, logger)

	var (
		mu          sync.Mutex
		entities    []catalogEntity
		tracks      []ResolvedTrackInfo
		seenTrack   = make(map[string]bool)
		topSCQuery  string
		wg          sync.WaitGroup
	)

	addEntity := func(text string, score float64, isArtist bool, reason string) {
		text = normReplacer.Replace(text)
		text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
		if text == "" {
			return
		}
		mu.Lock()
		entities = append(entities, catalogEntity{
			text:     text,
			tier:     1, // Приоритет №1 (SoundCloud)
			score:    score,
			isArtist: isArtist,
			source:   "SoundCloud",
			reason:   reason,
		})
		mu.Unlock()
	}

	addTrack := func(artist, track, album, role string) {
		artist = strings.TrimSpace(artist)
		track = strings.TrimSpace(track)
		album = strings.TrimSpace(album)
		if artist == "" || track == "" {
			return
		}
		key := strings.ToLower(artist + "|" + track)
		mu.Lock()
		if !seenTrack[key] {
			seenTrack[key] = true
			tracks = append(tracks, ResolvedTrackInfo{
				Artist: artist,
				Track:  track,
				Album:  album,
				Role:   role,
				Source: "SoundCloud",
			})
		}
		mu.Unlock()
	}

	processSCTrackList := func(scTracks []scTrackObject, probe string, via string) {
		var topSummary []string
		for i, tr := range scTracks {
			artist, trackName, albumName := extractSCArtistTrackAlbum(tr)
			if artist == "" && trackName == "" {
				continue
			}
			if i < 4 {
				if albumName != "" {
					topSummary = append(topSummary, fmt.Sprintf("%s — %s [альбом: %s, ▶%d]", artist, trackName, albumName, tr.PlaybackCount))
				} else {
					topSummary = append(topSummary, fmt.Sprintf("%s — %s [▶%d]", artist, trackName, tr.PlaybackCount))
				}
			}

			// Бонус за популярность трека в SoundCloud (playback_count)
			popBonus := math.Min(0.04, math.Log10(float64(tr.PlaybackCount+1))*0.006)

			artistMatches := matchWithinTwoLettersNoSymbols(artist, rawQuery) || matchWithinTwoLettersNoSymbols(artist, probe)
			trackMatches := matchWithinTwoLettersNoSymbols(trackName, rawQuery) || matchWithinTwoLettersNoSymbols(trackName, probe)
			albumMatches := albumName != "" && (matchWithinTwoLettersNoSymbols(albumName, rawQuery) || matchWithinTwoLettersNoSymbols(albumName, probe))

			rankDecay := float64(i) * 0.003
			// 1. Совпал сам исполнитель (или это топ-3 хит по кириллическому запросу)
			if artistMatches || (i < 3 && hasCyrillic(probe) && !hasCyrillic(artist) && matchWithinTwoLettersNoSymbols(artist, probe)) {
				addEntity(artist, 0.995+popBonus-rankDecay, true, fmt.Sprintf("артист из трека SoundCloud «%s»", trackName))
				addTrack(artist, trackName, albumName, "primary_artist")
				if albumName != "" && !strings.EqualFold(albumName, trackName) {
					addEntity(artist+" "+albumName, 0.990+popBonus-rankDecay, false, fmt.Sprintf("альбом «%s» из метаданных трека SoundCloud", albumName))
				}
				if trackName != "" && !strings.EqualFold(artist, trackName) {
					addEntity(artist+" "+trackName, 0.984+popBonus-rankDecay, false, fmt.Sprintf("трек «%s» артиста «%s» в SoundCloud", trackName, artist))
				}
				mu.Lock()
				if topSCQuery == "" {
					topSCQuery = artist
				}
				mu.Unlock()
			} else if trackMatches || albumMatches {
				// 2. Пользователь искал песню или альбом, либо это одноимённый трек у другого исполнителя!
				addEntity(artist+" "+trackName, 0.994+popBonus-rankDecay, false, fmt.Sprintf("трек «%s» исполнителя «%s» в SoundCloud", trackName, artist))
				addEntity(artist, 0.986+popBonus-rankDecay, true, fmt.Sprintf("исполнитель найденного трека «%s» в SoundCloud", trackName))
				if albumName != "" {
					addEntity(artist+" "+albumName, 0.990+popBonus-rankDecay, false, fmt.Sprintf("альбом «%s» для трека «%s» в SoundCloud", albumName, trackName))
				}
				addTrack(artist, trackName, albumName, "other_artist_song")
				mu.Lock()
				if topSCQuery == "" {
					topSCQuery = artist + " " + trackName
				}
				mu.Unlock()
			} else if i < 8 && (tr.PlaybackCount >= 1000 || i < 4) {
				// 3. Топ-8 релевантных треков выдачи самого поиска SoundCloud (даёт артистов, их альбомы и треки для заполнения 10 слотов SoundCloud)
				if artist != "" {
					addEntity(artist, 0.978+popBonus-rankDecay, true, fmt.Sprintf("артист из топ-%d выдачи SoundCloud (▶%d)", i+1, tr.PlaybackCount))
				}
				if albumName != "" && artist != "" {
					addEntity(artist+" "+albumName, 0.982+popBonus-rankDecay, false, fmt.Sprintf("альбом «%s» из топ-%d выдачи SoundCloud", albumName, i+1))
				}
				if artist != "" && trackName != "" {
					addEntity(artist+" "+trackName, 0.975+popBonus-rankDecay, false, fmt.Sprintf("трек «%s — %s» из топ-%d выдачи SoundCloud", artist, trackName, i+1))
					addTrack(artist, trackName, albumName, "primary_artist")
				}
				mu.Lock()
				if topSCQuery == "" && artist != "" {
					topSCQuery = artist
				}
				mu.Unlock()
			}

			// Вытаскиваем связанных коллаб-артистов из поля artist/title
			for _, rel := range extractRelatedCollabArtists(artist, trackName, albumName, probe) {
				addEntity(rel, 0.95, true, "коллаб-артист из трека SoundCloud")
			}
		}
		if len(topSummary) > 0 {
			logger.Simple("☁️ SoundCloud (%s) по запросу «%s» -> нашёл %d треков за %d мс: %v",
				via, probe, len(scTracks), time.Since(t0).Milliseconds(), topSummary)
		}
	}

	scProbes := probes
	if len(scProbes) > 3 {
		scProbes = scProbes[:3]
	}

	for _, probe := range scProbes {
		// Ветка А: Официальный внутренний JSON API v2 SoundCloud (если есть clientID)
		if clientID != "" {
			wg.Add(2)
			// А1: Автодополнение поисковых запросов SoundCloud (/search/queries)
			go func(p string) {
				defer wg.Done()
				u := fmt.Sprintf("https://api-v2.soundcloud.com/search/queries?q=%s&client_id=%s&limit=8",
					url.QueryEscape(p), url.QueryEscape(clientID))
				req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
				if err != nil {
					return
				}
				req.Header.Set("User-Agent", "Mozilla/5.0")
				resp, err := httpClient.Do(req)
				if err != nil {
					return
				}
				defer resp.Body.Close()
				var qRes struct {
					Collection []struct {
						Output string `json:"output"`
						Query  string `json:"query"`
					} `json:"collection"`
				}
				if json.NewDecoder(resp.Body).Decode(&qRes) == nil && len(qRes.Collection) > 0 {
					for idx, item := range qRes.Collection {
						sug := strings.TrimSpace(item.Output)
						if sug == "" {
							sug = strings.TrimSpace(item.Query)
						}
						if sug != "" && (idx == 0 || matchWithinTwoLettersNoSymbols(sug, rawQuery)) {
							addEntity(sug, 0.995-float64(idx)*0.005, false, "подсказка SoundCloud Autocomplete")
							mu.Lock()
							if topSCQuery == "" {
								topSCQuery = sug
							}
							mu.Unlock()
						}
					}
					logger.Simple("☁️ SoundCloud Autocomplete по «%s» -> подсказал: «%s»", p, qRes.Collection[0].Output)
				}
			}(probe)

			// А2: Поиск треков с метаданными альбомов и исполнителей (/search/tracks)
			go func(p string) {
				defer wg.Done()
				u := fmt.Sprintf("https://api-v2.soundcloud.com/search/tracks?q=%s&client_id=%s&limit=25",
					url.QueryEscape(p), url.QueryEscape(clientID))
				req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
				if err != nil {
					return
				}
				req.Header.Set("User-Agent", "Mozilla/5.0")
				resp, err := httpClient.Do(req)
				if err != nil {
					logger.Trace("[SoundCloud-Tracks] ERR query=%q err=%v", p, err)
					return
				}
				defer resp.Body.Close()
				var trRes struct {
					Collection []scTrackObject `json:"collection"`
				}
				if json.NewDecoder(resp.Body).Decode(&trRes) == nil && len(trRes.Collection) > 0 {
					processSCTrackList(trRes.Collection, p, "API-v2")
				}
			}(probe)
		} else {
			// Ветка Б: Бесключевой фоллбэк — парсинг window.__sc_hydration прямо со страницы поиска soundcloud.com/search/sounds
			wg.Add(1)
			go func(p string) {
				defer wg.Done()
				u := "https://soundcloud.com/search/sounds?q=" + url.QueryEscape(p)
				req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
				if err != nil {
					return
				}
				req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")
				resp, err := httpClient.Do(req)
				if err != nil {
					return
				}
				b, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				m := reSCHydration.FindSubmatch(b)
				if len(m) < 2 {
					return
				}
				var hyd []struct {
					Hydratable string          `json:"hydratable"`
					Data       json.RawMessage `json:"data"`
				}
				if json.Unmarshal(m[1], &hyd) == nil {
					for _, h := range hyd {
						var searchBlock struct {
							Collection []scTrackObject `json:"collection"`
						}
						if json.Unmarshal(h.Data, &searchBlock) == nil && len(searchBlock.Collection) > 0 {
							processSCTrackList(searchBlock.Collection, p, "SSR-Hydration")
						}
					}
				}
			}(probe)
		}
	}

	wg.Wait()
	return entities, tracks, topSCQuery
}

// ============================================================================
// 6. ДОПОЛНИТЕЛЬНЫЕ КАТАЛОГИ (Google Suggest, MusicBrainz, iTunes, Deezer)
// ============================================================================

func fetchGoogleSuggest(ctx context.Context, query, hl string, logger *SearchLogger) string {
	t0 := time.Now()
	u := fmt.Sprintf("https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=%s&q=%s",
		url.QueryEscape(hl), url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Simple("⚠️ Запрос к Google Suggest (%s) с «%s» -> ошибка сети: %v", hl, query, err)
		logger.Trace("[GoogleSuggest] ERR url=%s err=%v", u, err)
		return ""
	}
	defer resp.Body.Close()

	var raw []interface{}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil || len(raw) < 2 {
		return ""
	}
	arr, ok := raw[1].([]interface{})
	if !ok || len(arr) == 0 {
		logger.Simple("🌐 Запрос к Google Suggest (%s) с «%s» -> сервер ответил пустым списком (%d мс)", hl, query, time.Since(t0).Milliseconds())
		return ""
	}
	first, _ := arr[0].(string)
	cleaned := strings.Join(strings.Fields(strings.TrimSpace(reNoiseWords.ReplaceAllString(first, ""))), " ")
	if cleaned != first {
		logger.Simple("🌐 Запрос к Google Suggest (%s) с «%s» -> сервер ответил «%s» (%d мс), функция reNoiseWords отрезала лишние слова -> «%s»",
			hl, query, first, time.Since(t0).Milliseconds(), cleaned)
	} else {
		logger.Simple("🌐 Запрос к Google Suggest (%s) с «%s» -> сервер ответил: «%s» (%d мс)",
			hl, query, cleaned, time.Since(t0).Milliseconds())
	}
	logger.Trace("[GoogleSuggest] OK hl=%s query=%q raw_first=%q cleaned=%q latency=%dms", hl, query, first, cleaned, time.Since(t0).Milliseconds())
	return cleaned
}

func fetchMusicBrainzAliases(ctx context.Context, query string, logger *SearchLogger) []string {
	t0 := time.Now()
	u := fmt.Sprintf("https://musicbrainz.org/ws/2/artist/?query=%s&fmt=json&limit=5", url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "JennyPlayerOmniCore/3.2")
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Simple("⚠️ Запрос к MusicBrainz с «%s» -> ошибка соединения: %v", query, err)
		logger.Trace("[MusicBrainz] ERR url=%s err=%v", u, err)
		return nil
	}
	defer resp.Body.Close()

	var data struct {
		Artists []struct {
			Name    string `json:"name"`
			Score   int    `json:"score"`
			Aliases []struct {
				Name string `json:"name"`
			} `json:"aliases"`
		} `json:"artists"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil
	}
	var out []string
	for _, a := range data.Artists {
		matchedAlias := ""
		for _, al := range a.Aliases {
			if matchWithinTwoLettersNoSymbols(al.Name, query) {
				matchedAlias = al.Name
				break
			}
		}
		if matchWithinTwoLettersNoSymbols(a.Name, query) || matchedAlias != "" {
			out = append(out, a.Name)
			logger.Trace("[MusicBrainz] ACCEPT artist=%q score=%d matchedAlias=%q for query=%q", a.Name, a.Score, matchedAlias, query)
		} else {
			logger.Trace("[MusicBrainz] SKIP artist=%q score=%d for query=%q", a.Name, a.Score, query)
		}
	}
	if len(out) > 0 {
		logger.Simple("🌐 Запрос к MusicBrainz с «%s» -> сервер ответил за %d мс: найдены артисты %v", query, time.Since(t0).Milliseconds(), out)
	} else {
		logger.Simple("🌐 Запрос к MusicBrainz с «%s» -> сервер ответил за %d мс: совпадений не найдено", query, time.Since(t0).Milliseconds())
	}
	return out
}

func extractRelatedCollabArtists(artistField, trackField, albumField, probe string) []string {
	pLow := strings.ToLower(strings.TrimSpace(probe))
	pTokens := tokenize(pLow)
	if len(pTokens) == 0 {
		return nil
	}

	fullText := strings.ToLower(artistField + " " + trackField + " " + albumField)
	mentionsProbe := len([]rune(pLow)) >= 3 && strings.Contains(fullText, pLow)

	sepReplacer := strings.NewReplacer(
		" feat. ", "|", " feat ", "|", " ft. ", "|", " ft ", "|",
		" & ", "|", ", ", "|", " x ", "|", " X ", "|", " и ", "|", " / ", "|", " (", "|", ")", "|",
	)
	parts := strings.Split(sepReplacer.Replace(artistField), "|")

	// Если в списке исполнителей трека ("Витя АК, АК-47" или "Кипелов, Ария") один из артистов совпал с запросом,
	// обязательно вытаскиваем ВТОРОГО связанного артиста/группу ("АК-47", "Ария")!
	anyMatchedProbe := false
	for _, pt := range parts {
		pt = strings.TrimSpace(pt)
		if matchWithinTwoLettersNoSymbols(pt, probe) {
			anyMatchedProbe = true
			break
		}
	}
	if anyMatchedProbe && len(parts) > 1 {
		var partners []string
		for _, pt := range parts {
			pt = strings.TrimSpace(pt)
			if len([]rune(pt)) >= 2 && len([]rune(pt)) <= 28 && !matchWithinTwoLettersNoSymbols(pt, probe) {
				partners = append(partners, pt)
			}
		}
		if len(partners) > 0 {
			return partners
		}
	}

	sharesRoot := false
	for _, pt := range parts {
		ptTokens := tokenize(strings.ToLower(pt))
		for _, at := range ptTokens {
			if len([]rune(at)) < 2 {
				continue
			}
			for _, qt := range pTokens {
				if at == qt {
					sharesRoot = true
					break
				}
			}
		}
	}

	if !sharesRoot && !mentionsProbe {
		return nil
	}
	if !sharesRoot && !hasCyrillic(probe) {
		return nil
	}

	var out []string
	for _, pt := range parts {
		pt = strings.TrimSpace(pt)
		if len([]rune(pt)) >= 2 && len([]rune(pt)) <= 25 {
			out = append(out, pt)
		}
	}
	return out
}

func fetchCatalogEntities(ctx context.Context, queries []string, rawQuery string, logger *SearchLogger) ([]catalogEntity, []ResolvedTrackInfo) {
	var (
		mu       sync.Mutex
		entities []catalogEntity
		tracks   []ResolvedTrackInfo
		seenTrk  = make(map[string]bool)
		wg       sync.WaitGroup
	)

	addEntity := func(text string, score float64, isArtist bool, source, reason string) {
		text = normReplacer.Replace(text)
		text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
		if text == "" {
			return
		}
		mu.Lock()
		entities = append(entities, catalogEntity{text: text, tier: 3, score: score, isArtist: isArtist, source: source, reason: reason})
		mu.Unlock()
	}

	addTrack := func(artist, track, album, role, source string) {
		artist = strings.TrimSpace(artist)
		track = strings.TrimSpace(track)
		album = strings.TrimSpace(album)
		if artist == "" || track == "" {
			return
		}
		key := strings.ToLower(artist + "|" + track)
		mu.Lock()
		if !seenTrk[key] {
			seenTrk[key] = true
			tracks = append(tracks, ResolvedTrackInfo{
				Artist: artist,
				Track:  track,
				Album:  album,
				Role:   role,
				Source: source,
			})
		}
		mu.Unlock()
	}

	evaluateCatalogHit := func(artistName, trackName, albumName, source, probeQuery string) {
		cleanTrack := strings.TrimSpace(reBracketMeta.ReplaceAllString(trackName, ""))
		artistMatches := matchWithinTwoLettersNoSymbols(artistName, rawQuery) || matchWithinTwoLettersNoSymbols(artistName, probeQuery)
		trackMatches := matchWithinTwoLettersNoSymbols(cleanTrack, rawQuery) || matchWithinTwoLettersNoSymbols(cleanTrack, probeQuery)

		if artistMatches {
			addEntity(artistName, 0.94, true, source, "совпадение имени исполнителя")
			if albumName != "" && !strings.EqualFold(albumName, cleanTrack) {
				addEntity(artistName+" "+albumName, 0.92, false, source, fmt.Sprintf("альбом «%s»", albumName))
			}
			addTrack(artistName, trackName, albumName, "primary_artist", source)
			logger.Trace("[%s] HIT primary_artist=%q track=%q album=%q", source, artistName, trackName, albumName)
		} else if trackMatches {
			combo := artistName + " " + cleanTrack
			addEntity(combo, 0.89, false, source, fmt.Sprintf("песня «%s» у другого исполнителя «%s»", cleanTrack, artistName))
			if albumName != "" {
				addEntity(artistName+" "+albumName, 0.88, false, source, fmt.Sprintf("альбом «%s» для песни «%s»", albumName, cleanTrack))
			}
			addTrack(artistName, trackName, albumName, "other_artist_song", source)
			logger.Trace("[%s] HIT other_artist_song: track=%q by artist=%q (album=%q)", source, trackName, artistName, albumName)
		} else {
			// Проверяем, есть ли общий значимый токен (>= 2 символов) между запросом и именем артиста (например, токен "ак" в "витя ак" и "АК-47")
			pToks := tokenize(probeQuery)
			aToks := tokenize(artistName)
			sharedTok := false
			for _, pt := range pToks {
				if len([]rune(pt)) < 2 {
					continue
				}
				for _, at := range aToks {
					if matchStringsIR(pt, at) {
						sharedTok = true
						break
					}
				}
			}
			if sharedTok {
				addEntity(artistName, 0.92, true, source, fmt.Sprintf("общий корневой токен с «%s»", probeQuery))
				addTrack(artistName, trackName, albumName, "primary_artist", source)
			} else {
				addTrack(artistName, trackName, albumName, "catalog_candidate", source)
			}
			logger.Trace("[%s] CANDIDATE result (sharedTok=%v): artist=%q track=%q album=%q", source, sharedTok, artistName, trackName, albumName)
		}
	}

	probeList := queries
	if len(probeList) > 6 {
		probeList = probeList[:6]
	}

	for _, q := range probeList {
		for _, country := range []string{"RU", "US"} {
			wg.Add(1)
			go func(probe, c string) {
				defer wg.Done()
				t0 := time.Now()
				u := fmt.Sprintf("https://itunes.apple.com/search?term=%s&country=%s&media=music&entity=song&limit=20",
					url.QueryEscape(probe), c)
				req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
				if err != nil {
					return
				}
				req.Header.Set("User-Agent", "Mozilla/5.0")
				resp, err := httpClient.Do(req)
				if err != nil {
					logger.Trace("[iTunes-%s] ERR query=%q err=%v", c, probe, err)
					return
				}
				defer resp.Body.Close()

				var res struct {
					Results []struct {
						ArtistName     string `json:"artistName"`
						TrackName      string `json:"trackName"`
						CollectionName string `json:"collectionName"`
					} `json:"results"`
				}
				if json.NewDecoder(resp.Body).Decode(&res) == nil {
					var topArtists []string
					for i, r := range res.Results {
						if i < 3 {
							topArtists = append(topArtists, fmt.Sprintf("%s — %s", r.ArtistName, r.TrackName))
						}
						for _, rel := range extractRelatedCollabArtists(r.ArtistName, r.TrackName, r.CollectionName, probe) {
							addEntity(rel, 0.91, false, "iTunes", "связанный проект «"+rel+"»")
						}
						if i < 2 && hasCyrillic(probe) && !hasCyrillic(r.ArtistName) && matchWithinTwoLettersNoSymbols(r.ArtistName, probe) {
							addEntity(r.ArtistName, 0.93, true, "iTunes-"+c, "прямой перевод имени артиста каталогом iTunes")
						}
						evaluateCatalogHit(r.ArtistName, r.TrackName, r.CollectionName, "iTunes-"+c, probe)
					}
					logger.Simple("🌐 Запрос к iTunes (%s) с «%s» -> сервер ответил за %d мс (%d треков, топ: %v)",
						c, probe, time.Since(t0).Milliseconds(), len(res.Results), topArtists)
				}
			}(q, country)
		}

		for _, ep := range []struct{ name, urlFmt string }{
			{"Deezer-Search", "https://api.deezer.com/search?q=%s&limit=18"},
			{"Deezer-Track", "https://api.deezer.com/search/track?q=%s&limit=18"},
		} {
			wg.Add(1)
			go func(probe, srcName, urlFmt string) {
				defer wg.Done()
				t0 := time.Now()
				u := fmt.Sprintf(urlFmt, url.QueryEscape(probe))
				req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
				if err != nil {
					return
				}
				req.Header.Set("User-Agent", "Mozilla/5.0")
				resp, err := httpClient.Do(req)
				if err != nil {
					logger.Trace("[%s] ERR query=%q err=%v", srcName, probe, err)
					return
				}
				defer resp.Body.Close()

				var res struct {
					Data []struct {
						Title      string `json:"title"`
						TitleShort string `json:"title_short"`
						Artist     struct {
							Name string `json:"name"`
						} `json:"artist"`
						Album struct {
							Title string `json:"title"`
						} `json:"album"`
					} `json:"data"`
				}
				if json.NewDecoder(resp.Body).Decode(&res) == nil {
					var topItems []string
					for i, d := range res.Data {
						if i < 3 {
							topItems = append(topItems, fmt.Sprintf("%s — %s", d.Artist.Name, d.Title))
						}
						for _, rel := range extractRelatedCollabArtists(d.Artist.Name, d.Title, d.Album.Title, probe) {
							addEntity(rel, 0.91, false, "Deezer", "связанный проект «"+rel+"»")
						}
						if i < 2 && hasCyrillic(probe) && !hasCyrillic(d.Artist.Name) && matchWithinTwoLettersNoSymbols(d.Artist.Name, probe) {
							addEntity(d.Artist.Name, 0.93, true, srcName, "прямой перевод имени артиста каталогом Deezer")
						}
						evaluateCatalogHit(d.Artist.Name, d.Title, d.Album.Title, srcName, probe)
					}
					logger.Simple("🌐 Запрос к %s с «%s» -> сервер ответил за %d мс (%d треков, топ: %v)",
						srcName, probe, time.Since(t0).Milliseconds(), len(res.Data), topItems)
				}
			}(q, ep.name, ep.urlFmt)
		}
	}

	wg.Wait()

	// Чисто алгоритмическое выявление консенсусного артиста по частоте в ответах каталогов (без словарей!):
	// Если по запросу ("витя ак", "горшок", "цой", "богемская рапсодия") каталоги вернули >= 3 треков одного и того же исполнителя,
	// автоматически выдвигаем этого исполнителя в кандидаты!
	artistFreq := make(map[string]int)
	artistDisplay := make(map[string]string)
	for _, tr := range tracks {
		sepReplacer := strings.NewReplacer(",", "|", "&", "|", "feat.", "|", "ft.", "|")
		for _, part := range strings.Split(sepReplacer.Replace(tr.Artist), "|") {
			part = strings.TrimSpace(part)
			if len([]rune(part)) >= 2 {
				k := strings.ToLower(part)
				artistFreq[k]++
				artistDisplay[k] = part
			}
		}
	}
	for k, cnt := range artistFreq {
		if cnt >= 2 {
			disp := artistDisplay[k]
			addEntity(disp, 0.95, true, "CatalogConsensus", fmt.Sprintf("консенсус каталогов (%d совпадений треков)", cnt))
			logger.Simple("🧠 Алгоритм консенсуса каталогов: для «%s» выявлен связанный исполнитель «%s» (встретился в %d треках)", rawQuery, disp, cnt)
		}
	}

	return entities, tracks
}

// buildExpandedQueries строит ДО 10 ИТОГОВЫХ ЗАПРОСОВ по СТУПЕНЧАТЫМ ПРИОРИТЕТАМ:
// Ступень 1 (Приоритет №1): SoundCloud (треки -> исполнитель + альбом + название песни)
// Ступень 2 (Приоритет №2): Каскадный Google Suggest + MusicBrainz Aliases
// Ступень 3 (Приоритет №3): Каталоги iTunes + Deezer (включая связанные проекты и одноимённые песни)
// Ступень 4 (Приоритет №4): Собственные алгоритмы ядра (дифтонги, слоги, фонетика)
// Ступень 5 (Приоритет №5): Исходный запрос / переключённая раскладка
func buildExpandedQueries(ctx context.Context, rawQuery string, cfg EngineConfig, logger *SearchLogger) ([]string, string, []ResolvedTrackInfo) {
	q := strings.Join(strings.Fields(strings.TrimSpace(rawQuery)), " ")
	scored := make(map[string]candInfo)
	var mu sync.Mutex

	addCand := func(text string, tier int, score float64, isArtist bool, reason string) {
		text = normReplacer.Replace(text)
		text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
		if text == "" {
			return
		}
		key := strings.ToLower(text)
		mu.Lock()
		defer mu.Unlock()
		// Кандидат побеждает, если у него выше ступень (меньше номер tier) ИЛИ при равной ступени выше score
		if cur, ok := scored[key]; !ok || tier < cur.tier || (tier == cur.tier && score > cur.score) {
			scored[key] = candInfo{text: text, tier: tier, score: score, isArtist: isArtist, reason: reason}
			logger.Trace("[Candidate] + [Tier-%d | %.3f] %q (isArtist=%v, reason=%s)", tier, score, text, isArtist, reason)
		}
	}

	// Ступень 5: Исходный запрос пользователя
	addCand(q, 5, 0.80, false, "исходный запрос пользователя")


	logger.Simple("🦴 Функция phoneticSkeleton: звуковой скелет запроса «%s» -> «%s»", q, phoneticSkeleton(q))

	// 1. Проверка ошибочной раскладки клавиатуры
	probe := q
	if !hasVowels(q) && len([]rune(q)) >= 2 {
		if hasCyrillic(q) {
			probe = kbdRuToEn.Replace(q)
		} else {
			probe = kbdEnToRu.Replace(q)
		}
		logger.Simple("⌨️ Функция fixKeyboardLayout: в «%s» нет гласных букв -> переключена раскладка на «%s»", q, probe)
		addCand(probe, 5, 0.82, false, "исправление раскладки клавиатуры")
	}

	// Ступень 4: Собственные фонетические и дифтонговые алгоритмы ядра
	var anglo []string
	if cfg.EnablePhonetic {
		anglo = ruAngloPhoneticVariants(probe, logger)
		for i, v := range anglo {
			sc := 0.89 - float64(i)*0.008
			if sc < 0.81 {
				sc = 0.81
			}
			addCand(v, 4, sc, false, "собственный алгоритм дифтонгов/фонетики ядра")
		}
	}

	var (
		topSC      string
		topSug     string
		tracks     []ResolvedTrackInfo
		wg         sync.WaitGroup
	)

	catalogProbes := []string{probe}
	for i := 0; i < len(anglo) && i < 5; i++ {
		catalogProbes = append(catalogProbes, anglo[i])
	}

	// Параллельный запуск Ступени 1 (SoundCloud), Ступени 2 (Google Suggest + MusicBrainz) и Ступени 3 (iTunes + Deezer)
	if cfg.EnableSoundCloud {
		wg.Add(1)
		go func() {
			defer wg.Done()
			scEnts, scTrks, scBest := fetchSoundCloudPriority(ctx, catalogProbes, probe, cfg, logger)
			mu.Lock()
			if scBest != "" {
				topSC = scBest
			}
			tracks = append(tracks, scTrks...)
			mu.Unlock()
			for _, e := range scEnts {
				addCand(e.text, 1, e.score, e.isArtist, "SoundCloud [Приоритет №1]: "+e.reason)
			}
		}()
	}

	if cfg.EnableCatalog {
		wg.Add(3)
		// Ступень 2А: Каскадный Google Suggest
		go func() {
			defer wg.Done()
			for idx, sug := range fetchCascadingGoogleSuggest(ctx, probe, anglo, logger) {
				if idx == 0 {
					mu.Lock()
					topSug = sug
					mu.Unlock()
				}
				addCand(sug, 2, 0.97-float64(idx)*0.01, false, "каскад Google Suggest [Ступень 2]")
			}
		}()
		// Ступень 2Б: MusicBrainz Aliases
go func() {
defer wg.Done()
var mbWg sync.WaitGroup
for _, p := range catalogProbes {
mbWg.Add(1)
go func(probeStr string) {
defer mbWg.Done()
for _, a := range fetchMusicBrainzAliases(ctx, probeStr, logger) {
addCand(a, 2, 0.975, true, "алиас артиста из MusicBrainz [Ступень 2]")
}
}(p)
}
mbWg.Wait()
}()
// Ступень 3: iTunes + Deezer
		go func() {
			defer wg.Done()
			ents, trks := fetchCatalogEntities(ctx, catalogProbes, probe, logger)
			mu.Lock()
			tracks = append(tracks, trks...)
			mu.Unlock()
			for _, e := range ents {
				addCand(e.text, 3, e.score, e.isArtist, e.source+" [Ступень 3]: "+e.reason)
			}
		}()
	}
	wg.Wait()

	// Сортируем строго по ступеням приоритета (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5), а внутри ступени — по убыванию score
	var list []candInfo
	for _, v := range scored {
		list = append(list, v)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].tier != list[j].tier {
			return list[i].tier < list[j].tier
		}
		return list[i].score > list[j].score
	})

	// Формируем ДО 20 итоговых запросов:
	// - Первые до 10 слотов: кандидаты Ступени 1 (SoundCloud: исполнители, альбомы из треков, треки, автодополнение)
	// - Следующие 10 слотов (до 20 в сумме): остальные ступени (Google Suggest, MusicBrainz, iTunes, Deezer, дифтонги/фонетика, оригинал)
	const (
		maxTotalSlots = 20
		maxSCSlots    = 10
	)
	var scItems []candInfo
	var otherItems []candInfo
	for _, item := range list {
		if item.tier == 1 {
			scItems = append(scItems, item)
		} else {
			otherItems = append(otherItems, item)
		}
	}

	var selected []candInfo
	seenSelected := make(map[string]bool)
	addSelected := func(c candInfo) {
		k := strings.ToLower(strings.TrimSpace(c.text))
		if k == "" || seenSelected[k] {
			return
		}
		seenSelected[k] = true
		selected = append(selected, c)
	}

	// 1. Забираем до 10 лучших слотов от SoundCloud (Ступень 1)
	for _, item := range scItems {
		if len(selected) >= maxSCSlots {
			break
		}
		addSelected(item)
	}
	scCount := len(selected)

	// 2. Заполняем оставшиеся слоты (до 20 всего) кандидатами Ступеней 2..5 (Google Suggest, MusicBrainz, iTunes, Deezer, фонетика/дифтонги)
	for _, item := range otherItems {
		if len(selected) >= maxTotalSlots {
			break
		}
		addSelected(item)
	}

	// 3. Если после Ступеней 2..5 ещё остались свободные места до 20, добираем оставшимися кандидатами SoundCloud (если их было >10)
	if len(selected) < maxTotalSlots && len(scItems) > maxSCSlots {
		for _, item := range scItems[maxSCSlots:] {
			if len(selected) >= maxTotalSlots {
				break
			}
			addSelected(item)
		}
	}

	var finalTerms []string
	var ladderLog []string
	hasOtherSongTerm := false
	for _, item := range selected {
		finalTerms = append(finalTerms, item.text)
		ladderLog = append(ladderLog, fmt.Sprintf("#%02d [Ступень %d | %.2f] «%s» (%s)", len(finalTerms), item.tier, item.score, item.text, item.reason))
		if strings.Contains(item.reason, "другого исполнителя") {
			hasOtherSongTerm = true
		}
	}

	// Гарантируем слот для одноимённой песни другого исполнителя, если она нашлась, но не попала в 20 слотов
	if !hasOtherSongTerm && len(finalTerms) >= maxTotalSlots {
		for _, item := range list {
			if strings.Contains(item.reason, "другого исполнителя") && !seenSelected[strings.ToLower(item.text)] {
				finalTerms[len(finalTerms)-1] = item.text
				ladderLog[len(ladderLog)-1] = fmt.Sprintf("#%02d [Ступень %d | %.2f] «%s» (%s)", len(finalTerms), item.tier, item.score, item.text, item.reason)
				break
			}
		}
	}
	logger.Simple("🧮 Распределение 20 слотов: SoundCloud (Ступень 1) = %d слотов, Остальные алгоритмы (Ступени 2..5) = %d слотов (всего: %d)",
		scCount, len(finalTerms)-scCount, len(finalTerms))

	logger.Simple("🪜 Ступенчатая лестница итоговых запросов (топ-%d):", len(finalTerms))
	for _, line := range ladderLog {
		logger.Simple("   • %s", line)
	}

	// На 1-м месте для основного исправленного запроса стоит SoundCloud (если нашёл), затем Google Suggest, затем фонетика
	corrected := probe
	if topSC != "" {
		corrected = topSC
	} else if topSug != "" {
		corrected = topSug
	} else if len(anglo) > 0 && hasCyrillic(probe) {
		corrected = anglo[0]
	}
	return finalTerms, corrected, tracks
}

// ============================================================================
// 7. ИНДЕКСАТОРЫ: Rutor (через Google DoH), BitSearch, ApiBay, Knaben
// ============================================================================

func resolveRutorIP(logger *SearchLogger) string {
	rutorIPMu.RLock()
	if time.Since(rutorIPTime) < 10*time.Minute && cachedRutorIP != "" {
		ip := cachedRutorIP
		rutorIPMu.RUnlock()
		return ip
	}
	rutorIPMu.RUnlock()

	t0 := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", "https://dns.google/resolve?name=rutor.info&type=A", nil)
	if err != nil {
		return cachedRutorIP
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		rutorIPMu.Lock()
		rutorIPTime = time.Now()
		rutorIPMu.Unlock()
		if logger != nil {
			logger.Trace("[DoH-Rutor] ERR err=%v using cached=%s", err, cachedRutorIP)
		}
		return cachedRutorIP
	}
	defer resp.Body.Close()

	var dnsResp struct {
		Answer []struct {
			Type int    `json:"type"`
			Data string `json:"data"`
		} `json:"Answer"`
	}
	if json.NewDecoder(resp.Body).Decode(&dnsResp) == nil {
		for _, a := range dnsResp.Answer {
			if a.Type == 1 && net.ParseIP(a.Data) != nil {
				rutorIPMu.Lock()
				cachedRutorIP = a.Data
				rutorIPTime = time.Now()
				rutorIPMu.Unlock()
				if logger != nil {
					logger.Simple("🌐 DoH-резолвер (dns.google): для rutor.info получен IP %s (%d мс)", a.Data, time.Since(t0).Milliseconds())
					logger.Trace("[DoH-Rutor] resolved IP=%s in %dms", a.Data, time.Since(t0).Milliseconds())
				}
				return a.Data
			}
		}
	}
	return cachedRutorIP
}

func searchRutorDoH(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	// Используем /100/2/ (логическое И по всем словам в любом порядке с сортировкой по сидам), чтобы находить раздачи вида "АК-47 (Витя АК)"
	u := "http://rutor.info/search/0/0/100/2/" + url.PathEscape(query)
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Host = "rutor.info"
	req.Header.Set("Host", "rutor.info")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[Rutor] HTTP ERR query=%q url=%s err=%v", query, u, err)
		return nil
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	rows := reRutorRow.FindAllStringSubmatch(string(bodyBytes), -1)

	var results []TorrentResult
	cutJunk := 0
	for _, r := range rows {
		rowHTML := strings.ReplaceAll(strings.ReplaceAll(r[1], "&nbsp;", " "), "&#160;", " ")
		mMag := reRutorMagnet.FindStringSubmatch(rowHTML)
		mTit := reRutorTitle.FindStringSubmatch(rowHTML)
		if len(mMag) < 3 || len(mTit) < 2 {
			continue
		}
		infoHash := strings.ToLower(mMag[2])
		title := cleanTitle(mTit[1])
		if false && reHardJunk.MatchString(title) {
			cutJunk++
			logger.Trace("[Rutor] REJECTED by reHardJunk: %q", title)
			continue
		}

		var sizeBytes int64
		if mSz := reRutorSize.FindStringSubmatch(rowHTML); len(mSz) >= 3 {
			val, _ := strconv.ParseFloat(strings.ReplaceAll(mSz[1], ",", "."), 64)
			switch strings.ToUpper(mSz[2]) {
			case "TB", "ТБ":
				sizeBytes = int64(val * 1024 * 1024 * 1024 * 1024)
			case "GB", "ГБ":
				sizeBytes = int64(val * 1024 * 1024 * 1024)
			case "MB", "МБ":
				sizeBytes = int64(val * 1024 * 1024)
			case "KB", "КБ":
				sizeBytes = int64(val * 1024)
			}
		}

		seeds, peers := 0, 0
		if mS := reRutorSeeds.FindStringSubmatch(rowHTML); len(mS) >= 2 {
			seeds, _ = strconv.Atoi(mS[1])
		}
		if mP := reRutorPeers.FindStringSubmatch(rowHTML); len(mP) >= 2 {
			peers, _ = strconv.Atoi(mP[1])
		}

		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      sizeBytes,
			SizeMB:    float64(sizeBytes) / (1024 * 1024),
			SizeHuman: formatBytes(sizeBytes),
			Seeds:     seeds,
			Peers:     peers,
			Source:    "Rutor",
		})
	}
	logger.Trace("[Rutor] DONE query=%q status=%d rawRows=%d kept=%d cutJunk=%d latency=%dms",
		query, resp.StatusCode, len(rows), len(results), cutJunk, time.Since(t0).Milliseconds())
	return results
}

func searchBitsearch(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	u := "https://bitsearch.to/search?q=" + url.QueryEscape(query) + "&sort=seeders"
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[BitSearch] HTTP ERR query=%q err=%v", query, err)
		return nil
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	blocks := reBitItem.Split(string(bodyBytes), -1)
	seen := make(map[string]bool)
	var results []TorrentResult
	cutJunk := 0

	for _, blk := range blocks[1:] {
		mMag := reBitMagnet.FindStringSubmatch(blk)
		if len(mMag) < 3 {
			continue
		}
		infoHash := strings.ToLower(mMag[2])
		if seen[infoHash] {
			continue
		}
		seen[infoHash] = true

		title := ""
		if m := reBitTitle1.FindStringSubmatch(blk); len(m) >= 2 {
			title = cleanTitle(m[1])
		} else if m := reBitTitle2.FindStringSubmatch(blk); len(m) >= 2 {
			title = cleanTitle(m[1])
		}
		if title == "" {
			title = cleanTitle(extractNameFromMagnet(mMag[1]))
		}
		if title == "" {
			continue
		}
		if false && reHardJunk.MatchString(title) {
			cutJunk++
			logger.Trace("[BitSearch] REJECTED by reHardJunk: %q", title)
			continue
		}

		var sizeBytes int64
		mSz := reBitSize2.FindStringSubmatch(blk)
		if len(mSz) < 3 {
			mSz = reBitSize1.FindStringSubmatch(blk)
		}
		if len(mSz) >= 3 {
			val, _ := strconv.ParseFloat(strings.ReplaceAll(mSz[1], ",", "."), 64)
			switch strings.ToUpper(mSz[2]) {
			case "TB":
				sizeBytes = int64(val * 1024 * 1024 * 1024 * 1024)
			case "GB":
				sizeBytes = int64(val * 1024 * 1024 * 1024)
			case "MB":
				sizeBytes = int64(val * 1024 * 1024)
			case "KB":
				sizeBytes = int64(val * 1024)
			}
		}

		seeds, peers := 0, 0
		if mS := reBitSeeds2.FindStringSubmatch(blk); len(mS) >= 2 {
			seeds, _ = strconv.Atoi(strings.ReplaceAll(mS[1], ",", ""))
		} else if mS := reBitSeeds1.FindStringSubmatch(blk); len(mS) >= 2 {
			seeds, _ = strconv.Atoi(strings.ReplaceAll(mS[1], ",", ""))
		}
		if mP := reBitPeers.FindStringSubmatch(blk); len(mP) >= 2 {
			peers, _ = strconv.Atoi(strings.ReplaceAll(mP[1], ",", ""))
		}

		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      sizeBytes,
			SizeMB:    float64(sizeBytes) / (1024 * 1024),
			SizeHuman: formatBytes(sizeBytes),
			Seeds:     seeds,
			Peers:     peers,
			Source:    "BitSearch",
		})
	}
	logger.Trace("[BitSearch] DONE query=%q status=%d blocks=%d kept=%d cutJunk=%d latency=%dms",
		query, resp.StatusCode, len(blocks)-1, len(results), cutJunk, time.Since(t0).Milliseconds())
	return results
}

func searchApiBay(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	u := "https://apibay.org/q.php?q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[ApiBay] HTTP ERR query=%q err=%v", query, err)
		return nil
	}
	defer resp.Body.Close()

	var items []struct {
		Name     string `json:"name"`
		InfoHash string `json:"info_hash"`
		Seeders  string `json:"seeders"`
		Leechers string `json:"leechers"`
		Size     string `json:"size"`
		Category string `json:"category"`
	}
	if json.NewDecoder(resp.Body).Decode(&items) != nil {
		return nil
	}

	var results []TorrentResult
	cutJunk := 0
	for _, it := range items {
		infoHash := strings.ToLower(strings.TrimSpace(it.InfoHash))
		if len(infoHash) != 40 || infoHash == "0000000000000000000000000000000000000000" {
			continue
		}
		title := cleanTitle(it.Name)
		if false && reHardJunk.MatchString(title) {
			cutJunk++
			logger.Trace("[ApiBay] REJECTED by reHardJunk: %q", title)
			continue
		}
		seeds, _ := strconv.Atoi(it.Seeders)
		peers, _ := strconv.Atoi(it.Leechers)
		sz, _ := strconv.ParseInt(it.Size, 10, 64)

		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      sz,
			SizeMB:    float64(sz) / (1024 * 1024),
			SizeHuman: formatBytes(sz),
			Seeds:     seeds,
			Peers:     peers,
			Source:    "ApiBay",
			Category:  it.Category,
		})
	}
	logger.Trace("[ApiBay] DONE query=%q rawItems=%d kept=%d cutJunk=%d latency=%dms",
		query, len(items), len(results), cutJunk, time.Since(t0).Milliseconds())
	return results
}

func searchKnaben(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	payload := map[string]interface{}{
		"query":           query,
		"size":            80,
		"order_by":        "seeders",
		"order_direction": "desc",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.knaben.eu/v1", bytes.NewReader(body))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[Knaben] HTTP ERR query=%q err=%v", query, err)
		return nil
	}
	defer resp.Body.Close()

	var data struct {
		Hits []struct {
			Title     string `json:"title"`
			MagnetUrl string `json:"magnetUrl"`
			Hash      string `json:"hash"`
			Bytes     int64  `json:"bytes"`
			Seeders   int    `json:"seeders"`
			Peers     int    `json:"peers"`
			Tracker   string `json:"tracker"`
			Category  string `json:"category"`
		} `json:"hits"`
	}
	if json.NewDecoder(resp.Body).Decode(&data) != nil {
		return nil
	}

	var results []TorrentResult
	cutJunk := 0
	for _, h := range data.Hits {
		title := cleanTitle(h.Title)
		if false && reHardJunk.MatchString(title) {
			cutJunk++
			logger.Trace("[Knaben] REJECTED by reHardJunk: %q", title)
			continue
		}
		infoHash := strings.ToLower(strings.TrimSpace(h.Hash))
		if infoHash == "" {
			infoHash = extractInfoHash(h.MagnetUrl)
		}
		if len(infoHash) != 40 {
			continue
		}
		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      h.Bytes,
			SizeMB:    float64(h.Bytes) / (1024 * 1024),
			SizeHuman: formatBytes(h.Bytes),
			Seeds:     h.Seeders,
			Peers:     h.Peers,
			Source:    "Knaben",
			Category:  h.Category,
		})
	}
	logger.Trace("[Knaben] DONE query=%q rawHits=%d kept=%d cutJunk=%d latency=%dms",
		query, len(data.Hits), len(results), cutJunk, time.Since(t0).Milliseconds())
	return results
}


// searchSolidTorrents опрашивает международный P2P-индексатор SolidTorrents (музыка, Lossless, дискографии)
func searchSolidTorrents(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	u := "https://solidtorrents.to/search?q=" + url.QueryEscape(query) + "&sort=seeders"
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[SolidTorrents] HTTP ERR query=%q err=%v", query, err)
		return nil
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	blocks := reBitItem.Split(string(bodyBytes), -1)
	seen := make(map[string]bool)
	var results []TorrentResult

	for _, blk := range blocks[1:] {
		mMag := reBitMagnet.FindStringSubmatch(blk)
		if len(mMag) < 3 {
			continue
		}
		infoHash := strings.ToLower(mMag[2])
		if seen[infoHash] {
			continue
		}
		seen[infoHash] = true

		title := ""
		if m := reBitTitle2.FindStringSubmatch(blk); len(m) >= 2 {
			title = cleanTitle(m[1])
		} else if m := reBitTitle1.FindStringSubmatch(blk); len(m) >= 2 {
			title = cleanTitle(m[1])
		}
		if title == "" {
			title = cleanTitle(extractNameFromMagnet(mMag[1]))
		}
		if title == "" {
			continue
		}

		var sizeBytes int64
		mSz := reBitSize2.FindStringSubmatch(blk)
		if len(mSz) < 3 {
			mSz = reBitSize1.FindStringSubmatch(blk)
		}
		if len(mSz) >= 3 {
			val, _ := strconv.ParseFloat(strings.ReplaceAll(mSz[1], ",", "."), 64)
			switch strings.ToUpper(mSz[2]) {
			case "TB":
				sizeBytes = int64(val * 1024 * 1024 * 1024 * 1024)
			case "GB":
				sizeBytes = int64(val * 1024 * 1024 * 1024)
			case "MB":
				sizeBytes = int64(val * 1024 * 1024)
			case "KB":
				sizeBytes = int64(val * 1024)
			}
		}

		seeds, peers := 0, 0
		if mS := reBitSeeds2.FindStringSubmatch(blk); len(mS) >= 2 {
			seeds, _ = strconv.Atoi(strings.ReplaceAll(mS[1], ",", ""))
		} else if mS := reBitSeeds1.FindStringSubmatch(blk); len(mS) >= 2 {
			seeds, _ = strconv.Atoi(strings.ReplaceAll(mS[1], ",", ""))
		}
		if mP := reBitPeers.FindStringSubmatch(blk); len(mP) >= 2 {
			peers, _ = strconv.Atoi(strings.ReplaceAll(mP[1], ",", ""))
		}

		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      sizeBytes,
			SizeMB:    float64(sizeBytes) / (1024 * 1024),
			SizeHuman: formatBytes(sizeBytes),
			Seeds:     seeds,
			Peers:     peers,
			Source:    "SolidTorrents",
		})
	}
	logger.Trace("[SolidTorrents] DONE query=%q kept=%d latency=%dms", query, len(results), time.Since(t0).Milliseconds())
	return results
}

// searchTorAPIRuTracker опрашивает шлюз TorAPI (RuTracker и NoNameClub без VPN и регистрации)
func searchTorAPIRuTracker(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	t0 := time.Now()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	baseURL := "https://torapi.vercel.app"
	configMu.RLock()
	if defaultConfig.TorAPIURL != "" {
		baseURL = strings.TrimRight(defaultConfig.TorAPIURL, "/")
	}
	configMu.RUnlock()

	u := fmt.Sprintf("%s/api/search/title/rutracker?query=%s&page=0", baseURL, url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Trace("[TorAPI-RuTracker] HTTP ERR query=%q err=%v", query, err)
		return nil
	}
	defer resp.Body.Close()

	var items []struct {
		Name     string `json:"Name"`
		Title    string `json:"title"`
		Magnet   string `json:"Magnet"`
		Hash     string `json:"Hash"`
		Seeds    string `json:"Seeds"`
		Peers    string `json:"Peers"`
		Size     string `json:"Size"`
		Category string `json:"Category"`
	}
	if json.NewDecoder(resp.Body).Decode(&items) != nil {
		return nil
	}

	var results []TorrentResult
	for _, it := range items {
		title := cleanTitle(it.Name)
		if title == "" {
			title = cleanTitle(it.Title)
		}
		infoHash := strings.ToLower(strings.TrimSpace(it.Hash))
		if infoHash == "" {
			infoHash = extractInfoHash(it.Magnet)
		}
		if len(infoHash) != 40 || title == "" {
			continue
		}
		seeds, _ := strconv.Atoi(strings.TrimSpace(it.Seeds))
		peers, _ := strconv.Atoi(strings.TrimSpace(it.Peers))

		var sizeBytes int64
		if mSz := reRutorSize.FindStringSubmatch(it.Size); len(mSz) >= 3 {
			val, _ := strconv.ParseFloat(strings.ReplaceAll(mSz[1], ",", "."), 64)
			switch strings.ToUpper(mSz[2]) {
			case "TB", "ТБ":
				sizeBytes = int64(val * 1024 * 1024 * 1024 * 1024)
			case "GB", "ГБ":
				sizeBytes = int64(val * 1024 * 1024 * 1024)
			case "MB", "МБ":
				sizeBytes = int64(val * 1024 * 1024)
			case "KB", "КБ":
				sizeBytes = int64(val * 1024)
			}
		}

		results = append(results, TorrentResult{
			Title:     title,
			Magnet:    buildMagnet(infoHash, title),
			InfoHash:  infoHash,
			Size:      sizeBytes,
			SizeMB:    float64(sizeBytes) / (1024 * 1024),
			SizeHuman: formatBytes(sizeBytes),
			Seeds:     seeds,
			Peers:     peers,
			Source:    "RuTracker(TorAPI)",
			Category:  it.Category,
		})
	}
	logger.Trace("[TorAPI-RuTracker] DONE query=%q kept=%d latency=%dms", query, len(results), time.Since(t0).Milliseconds())
	return results
}

// searchSoulseekSeeker подключается к P2P-сети Soulseek (протокол Android-клиента Seeker: server.slsknet.org:2242 и демон slskd)
func searchSoulseekSeeker(ctx context.Context, query string, logger *SearchLogger) []TorrentResult {
	configMu.RLock()
	cfg := defaultConfig
	configMu.RUnlock()
	if !cfg.EnableSeekerP2P {
		return nil
	}

	// 1. Если запущен локальный или удалённый демон slskd / Seeker REST Gateway (по умолчанию http://127.0.0.1:5000)
	slskdBase := strings.TrimRight(strings.TrimSpace(cfg.SlskdURL), "/")
	if slskdBase != "" {
		t0 := time.Now()
		reqCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
		defer cancel()

		payload, _ := json.Marshal(map[string]interface{}{"searchText": query, "searchTimeout": 3000})
		req, err := http.NewRequestWithContext(reqCtx, "POST", slskdBase+"/api/v0/searches", bytes.NewReader(payload))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			if cfg.SlskdAPIKey != "" {
				req.Header.Set("X-API-Key", cfg.SlskdAPIKey)
			}
			if resp, err := httpClient.Do(req); err == nil {
				var sRes struct {
					ID        string `json:"id"`
					Responses []struct {
						Username string `json:"username"`
						Files    []struct {
							Filename string `json:"filename"`
							Size     int64  `json:"size"`
							BitRate  int    `json:"bitRate"`
						} `json:"files"`
					} `json:"responses"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&sRes)
				resp.Body.Close()

				var results []TorrentResult
				for _, peer := range sRes.Responses {
					for _, f := range peer.Files {
						sum := md5.Sum([]byte(peer.Username + ":" + f.Filename))
						fakeHash := hex.EncodeToString(sum[:]) + hex.EncodeToString(sum[:4])
						title := fmt.Sprintf("[Seeker/Soulseek] %s (%d kbps)", filepath.Base(strings.ReplaceAll(f.Filename, "\\", "/")), f.BitRate)
						slskURI := fmt.Sprintf("slsk://%s/%s", url.PathEscape(peer.Username), url.PathEscape(strings.ReplaceAll(f.Filename, "\\", "/")))
						results = append(results, TorrentResult{
							Title:     title,
							Magnet:    slskURI,
							InfoHash:  fakeHash,
							Size:      f.Size,
							SizeMB:    float64(f.Size) / (1024 * 1024),
							SizeHuman: formatBytes(f.Size),
							Seeds:     5,
							Peers:     1,
							Source:    "Seeker(Soulseek)",
						})
					}
				}
				if len(results) > 0 {
					logger.Simple("🐦 Seeker/Soulseek P2P (%s): по запросу «%s» найдено %d файлов за %d мс",
						slskdBase, query, len(results), time.Since(t0).Milliseconds())
					return results
				}
			}
		}
	}

	// 2. Прямой бинарный протокол центрального сервера Soulseek (server.slsknet.org:2242, как в Android-клиенте Seeker)
	if cfg.SlskUsername != "" && cfg.SlskPassword != "" {
		conn, err := net.DialTimeout("tcp", "server.slsknet.org:2242", 2*time.Second)
		if err == nil {
			defer conn.Close()
			_ = conn.SetDeadline(time.Now().Add(2500 * time.Millisecond))
			// Пакет Login (Code = 1): [len][1][user][pass][version=160][md5(user+pass)][minor=1]
			var loginBuf bytes.Buffer
			_ = binary.Write(&loginBuf, binary.LittleEndian, uint32(1))
			writeSlskString := func(b *bytes.Buffer, s string) {
				_ = binary.Write(b, binary.LittleEndian, uint32(len(s)))
				b.WriteString(s)
			}
			writeSlskString(&loginBuf, cfg.SlskUsername)
			writeSlskString(&loginBuf, cfg.SlskPassword)
			_ = binary.Write(&loginBuf, binary.LittleEndian, uint32(160))
			h := md5.Sum([]byte(cfg.SlskUsername + cfg.SlskPassword))
			writeSlskString(&loginBuf, hex.EncodeToString(h[:]))
			_ = binary.Write(&loginBuf, binary.LittleEndian, uint32(1))

			var pkt bytes.Buffer
			_ = binary.Write(&pkt, binary.LittleEndian, uint32(loginBuf.Len()))
			pkt.Write(loginBuf.Bytes())
			_, _ = conn.Write(pkt.Bytes())

			// Пакет FileSearch (Code = 26): [len][26][ticket][query]
			var searchBuf bytes.Buffer
			_ = binary.Write(&searchBuf, binary.LittleEndian, uint32(26))
			_ = binary.Write(&searchBuf, binary.LittleEndian, uint32(rand.Int31()))
			writeSlskString(&searchBuf, query)
			var spkt bytes.Buffer
			_ = binary.Write(&spkt, binary.LittleEndian, uint32(searchBuf.Len()))
			spkt.Write(searchBuf.Bytes())
			_, _ = conn.Write(spkt.Bytes())
			logger.Trace("[Seeker-TCP] Dispatched Soulseek P2P search packet for %q to server.slsknet.org:2242", query)
		}
	}
	return nil
}

// ============================================================================
// 8. UDP BIT-TORRENT TRACKER SCRAPER (BEP-15)
// ============================================================================

func udpScrapeSingleTracker(trackerAddr string, hashes [][]byte, logger *SearchLogger) map[string][2]int {
	t0 := time.Now()
	out := make(map[string][2]int)
	if len(hashes) == 0 {
		return out
	}
	conn, err := net.DialTimeout("udp", trackerAddr, 1500*time.Millisecond)
	if err != nil {
		logger.Trace("[UDP-Scrape] dial err tracker=%s err=%v", trackerAddr, err)
		return out
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(1800 * time.Millisecond))

	txID := uint32(rand.Int31())
	var req [16]byte
	binary.BigEndian.PutUint64(req[0:8], 0x41727101980)
	binary.BigEndian.PutUint32(req[8:12], 0)
	binary.BigEndian.PutUint32(req[12:16], txID)
	if _, err := conn.Write(req[:]); err != nil {
		return out
	}

	var resp [16]byte
	if n, err := conn.Read(resp[:]); err != nil || n < 16 {
		return out
	}
	if binary.BigEndian.Uint32(resp[0:4]) != 0 || binary.BigEndian.Uint32(resp[4:8]) != txID {
		return out
	}
	connID := binary.BigEndian.Uint64(resp[8:16])

	if len(hashes) > 70 {
		hashes = hashes[:70]
	}
	txID2 := uint32(rand.Int31())
	sreq := make([]byte, 16+20*len(hashes))
	binary.BigEndian.PutUint64(sreq[0:8], connID)
	binary.BigEndian.PutUint32(sreq[8:12], 2)
	binary.BigEndian.PutUint32(sreq[12:16], txID2)
	for i, h := range hashes {
		copy(sreq[16+i*20:16+(i+1)*20], h)
	}
	if _, err := conn.Write(sreq); err != nil {
		return out
	}

	sresp := make([]byte, 8+12*len(hashes))
	n, err := conn.Read(sresp)
	if err != nil || n < 8 {
		return out
	}
	if binary.BigEndian.Uint32(sresp[0:4]) != 2 || binary.BigEndian.Uint32(sresp[4:8]) != txID2 {
		return out
	}

	count := (n - 8) / 12
	for i := 0; i < count && i < len(hashes); i++ {
		off := 8 + i*12
		seeders := int(binary.BigEndian.Uint32(sresp[off : off+4]))
		leechers := int(binary.BigEndian.Uint32(sresp[off+8 : off+12]))
		out[hex.EncodeToString(hashes[i])] = [2]int{seeders, leechers}
	}
	logger.Trace("[UDP-Scrape] OK tracker=%s scraped=%d/%d latency=%dms", trackerAddr, len(out), len(hashes), time.Since(t0).Milliseconds())
	return out
}

func udpScrapeBatch(results []TorrentResult, logger *SearchLogger) map[string][2]int {
	t0 := time.Now()
	seen := make(map[string]bool)
	var rawHashes [][]byte
	for _, r := range results {
		if len(r.InfoHash) == 40 && !seen[r.InfoHash] {
			if b, err := hex.DecodeString(r.InfoHash); err == nil && len(b) == 20 {
				seen[r.InfoHash] = true
				rawHashes = append(rawHashes, b)
			}
		}
	}
	merged := make(map[string][2]int)
	if len(rawHashes) == 0 {
		return merged
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, tr := range udpTrackers {
		wg.Add(1)
		go func(addr string) {
			defer wg.Done()
			res := udpScrapeSingleTracker(addr, rawHashes, logger)
			mu.Lock()
			for h, sp := range res {
				cur := merged[h]
				if sp[0] > cur[0] {
					cur[0] = sp[0]
				}
				if sp[1] > cur[1] {
					cur[1] = sp[1]
				}
				merged[h] = cur
			}
			mu.Unlock()
		}(tr)
	}
	wg.Wait()
	logger.Simple("🔄 Функция udpScrapeBatch: опрошено %d UDP-трекеров для %d торрентов за %d мс -> получены свежие сиды для %d раздач",
		len(udpTrackers), len(rawHashes), time.Since(t0).Milliseconds(), len(merged))
	return merged
}

// ============================================================================
// 9. РАНЖИРОВАНИЕ, ФИЛЬТРАЦИЯ И РАЗБИВКА НА 3–5 УМНЫХ КАТЕГОРИЙ
// ============================================================================

func isDiscographyOrCollection(title string) bool {
	t := strings.ToLower(title)
	for _, kw := range []string{"discography", "дискография", "collection", "коллекция", "anthology", "антология", "complete", "полное собрание", "альбомы", "albums"} {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

func hasCollabMarker(title string) bool {
	return reCollabMarkers.MatchString(title)
}

func matchesFormatFilter(title, formatTag string) bool {
	tag := strings.ToLower(strings.TrimSpace(formatTag))
	if tag == "" || tag == "all" {
		return true
	}
	t := strings.ToLower(title)
	if kws, ok := formatKeywordsMap[tag]; ok {
		for _, kw := range kws {
			if strings.Contains(t, kw) {
				return true
			}
		}
		return false
	}
	return strings.Contains(t, tag)
}

func searchSingleVariantAcrossIndexers(ctx context.Context, variant string, cfg EngineConfig, logger *SearchLogger) []TorrentResult {
	var jobs []searchJob
	jobs = append(jobs,
		searchJob{name: "Rutor", fn: searchRutorDoH, arg: variant},
		searchJob{name: "Knaben", fn: searchKnaben, arg: variant},
		searchJob{name: "RuTracker(TorAPI)", fn: searchTorAPIRuTracker, arg: variant},
		searchJob{name: "SolidTorrents", fn: searchSolidTorrents, arg: variant},
		searchJob{name: "BitSearch", fn: searchBitsearch, arg: variant},
		searchJob{name: "ApiBay", fn: searchApiBay, arg: variant},
		searchJob{name: "Seeker(Soulseek)", fn: searchSoulseekSeeker, arg: variant},
	)
	if strings.Contains(variant, "/") {
		cleanSlash := strings.Join(strings.Fields(strings.ReplaceAll(variant, "/", " ")), " ")
		jobs = append(jobs,
			searchJob{name: "Rutor", fn: searchRutorDoH, arg: cleanSlash},
			searchJob{name: "BitSearch", fn: searchBitsearch, arg: cleanSlash},
			searchJob{name: "Knaben", fn: searchKnaben, arg: cleanSlash},
		)
	}

	byHash := make(map[string]TorrentResult)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, job := range jobs {
		wg.Add(1)
		go func(j searchJob) {
			defer wg.Done()
			items := j.fn(ctx, j.arg, logger)
			if len(items) > 0 {
				top := items[0]
				logger.Simple("📡 Индексатор [%s]: запрос «%s» -> вернул %d раздач (топ: «%s», сидов: ▲%d)",
					j.name, j.arg, len(items), top.Title, top.Seeds)
			} else {
				logger.Trace("[IndexerEmpty] src=%s query=%q -> 0 results", j.name, j.arg)
			}
			mu.Lock()
			for _, it := range items {
				h := strings.ToLower(it.InfoHash)
				if ex, ok := byHash[h]; !ok || it.Seeds > ex.Seeds {
					it.MatchedVia = variant
					byHash[h] = it
				}
			}
			mu.Unlock()
		}(job)
	}
	wg.Wait()

	var out []TorrentResult
	for _, v := range byHash {
		out = append(out, v)
	}
	return out
}

func rankAndFilter(items []TorrentResult, rawQuery, corrected string, terms []string, tracks []ResolvedTrackInfo, cfg EngineConfig, logger *SearchLogger) ([]TorrentResult, int) {
	var filtered []TorrentResult
	hiddenZero := 0
	cutFormat := 0
	cutVideo := 0
	cutLowFuzzy := 0

	for _, it := range items {
		if cfg.HideZeroSeeds && it.Seeds <= 0 {
			hiddenZero++
			logger.Trace("[Filter] DROP zero_seeds: %q (src=%s)", it.Title, it.Source)
			continue
		}
		if cfg.MinTwoSeeds && it.Seeds < 2 {
			hiddenZero++
			logger.Trace("[Filter] DROP <2_seeds (%d): %q", it.Seeds, it.Title)
			continue
		}
		if !matchesFormatFilter(it.Title, cfg.FormatTag) {
			cutFormat++
			logger.Trace("[Filter] DROP format_mismatch (%s): %q", cfg.FormatTag, it.Title)
			continue
		}
		if cfg.Year != "" && !strings.Contains(it.Title, cfg.Year) {
			continue
		}

		bestSim := 0.0
		artistPart, restPart := splitTorrentArtistAndRest(it.Title)
		for _, term := range terms {
			if s := computeFuzzyScore(it.Title, term); s > bestSim {
				bestSim = s
			}
			// Если исполнитель раздачи напрямую совпадает с одним из расширенных вариантов (например, "АК-47" для запроса "витя ак")
			if artistPart != "" && matchWithinTwoLettersNoSymbols(artistPart, term) {
				if 0.90 > bestSim {
					bestSim = 0.90
				}
			}
		}

		if artistPart != "" && restPart != "" {
			if !matchWithinTwoLettersNoSymbols(artistPart, rawQuery) && !matchWithinTwoLettersNoSymbols(artistPart, corrected) {
				restSim := math.Max(computeFuzzyScore(restPart, rawQuery), computeFuzzyScore(restPart, corrected))
				if restSim >= 0.72 {
					if restSim > bestSim {
						bestSim = restSim
					}
					it.MatchedVia = fmt.Sprintf("other_artist_song:%s — %s", artistPart, restPart)
				}
			}
		}

		for _, tr := range tracks {
			if tr.Role == "other_artist_song" && tr.Artist != "" {
				s := computeFuzzyScore(it.Title, tr.Artist+" "+tr.Track)
				if s > bestSim {
					bestSim = s
					it.MatchedVia = fmt.Sprintf("other_artist_song:%s — %s", tr.Artist, tr.Track)
				}
			} else if tr.Album != "" {
				if s := computeFuzzyScore(it.Title, fmt.Sprintf("%s %s", tr.Artist, tr.Album)); s > bestSim {
					bestSim = s
					it.MatchedVia = fmt.Sprintf("track->album: %s - %s", tr.Artist, tr.Album)
				}
			}
			if isDiscographyOrCollection(it.Title) && tr.Artist != "" {
				if s := computeFuzzyScore(it.Title, tr.Artist); s > bestSim {
					bestSim = s
					if !strings.HasPrefix(it.MatchedVia, "other_artist_song:") {
						it.MatchedVia = fmt.Sprintf("track->discography: %s", tr.Artist)
					}
				}
			}
		}

		if bestSim < cfg.MinFuzzyScore && it.MatchedVia != "" && strings.Contains(strings.ToLower(it.Title), strings.ToLower(it.MatchedVia)) {
			bestSim = cfg.MinFuzzyScore + 0.05
		}
		if bestSim < cfg.MinFuzzyScore {
			cutLowFuzzy++
			logger.Trace("[Filter] DROP low_fuzzy (%.3f < %.3f): %q", bestSim, cfg.MinFuzzyScore, it.Title)
			continue
		}

		it.MatchScore = bestSim
		seedBoost := math.Log1p(float64(it.Seeds)) * 12.0
		audioBoost := 0.0
		if cfg.PreferAudio && reAudioMarkers.MatchString(it.Title) {
			audioBoost = 15.0
		}
		discoBoost := 0.0
		if isDiscographyOrCollection(it.Title) {
			discoBoost = 18.0
		}
		it.FinalRank = it.FinalRank + bestSim*100.0 + seedBoost + audioBoost + discoBoost
		filtered = append(filtered, it)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].FinalRank > filtered[j].FinalRank
	})

	logger.Simple("🧹 Функция rankAndFilter: из %d уникальных раздач отрезано: [0 сидов: %d шт., видео/книги: %d шт., не тот аудиоформат: %d шт., низкое сходство <%.2f: %d шт.] -> осталось %d раздач",
		len(items), hiddenZero, cutVideo, cutFormat, cfg.MinFuzzyScore, cutLowFuzzy, len(filtered))
	return filtered, hiddenZero
}

func buildSmartCategoryGroups(ranked []TorrentResult, rawQuery, corrected string, terms []string, tracks []ResolvedTrackInfo, logger *SearchLogger) []VariantGroup {
	primaryName := corrected
	if primaryName == "" {
		primaryName = rawQuery
	}

	var (
		catPrimaryArtist []TorrentResult
		catCollabsCovers []TorrentResult
		otherArtistMap   = make(map[string][]TorrentResult)
		otherArtistOrder []string
	)

	for _, it := range ranked {
		artistPart, restPart := splitTorrentArtistAndRest(it.Title)

		isOtherArtistSong := false
		otherLabel := ""

		if strings.HasPrefix(it.MatchedVia, "other_artist_song:") {
			isOtherArtistSong = true
			if artistPart != "" {
				otherLabel = artistPart
			} else {
				otherLabel = strings.TrimPrefix(it.MatchedVia, "other_artist_song:")
			}
		} else if artistPart != "" && restPart != "" {
			isPrimary := matchWithinTwoLettersNoSymbols(artistPart, rawQuery) ||
				matchWithinTwoLettersNoSymbols(artistPart, corrected) ||
				strings.Contains(normalizeCompact(artistPart), normalizeCompact(corrected)) ||
				strings.Contains(normalizeCompact(ruToEnStd.Replace(artistPart)), normalizeCompact(ruToEnStd.Replace(rawQuery)))

			if !isPrimary {
				isOtherArtistSong = true
				otherLabel = artistPart
			}
		}

		if isOtherArtistSong {
			key := strings.ToLower(strings.TrimSpace(otherLabel))
			if key == "" {
				key = "разные исполнители"
				otherLabel = "Разные исполнители"
			}
			if _, exists := otherArtistMap[key]; !exists {
				otherArtistOrder = append(otherArtistOrder, key)
			}
			otherArtistMap[key] = append(otherArtistMap[key], it)
			continue
		}

		if hasCollabMarker(it.Title) {
			catCollabsCovers = append(catCollabsCovers, it)
			continue
		}

		catPrimaryArtist = append(catPrimaryArtist, it)
	}

	var groups []VariantGroup

	if len(catPrimaryArtist) > 0 {
		groups = append(groups, VariantGroup{
			Query:           fmt.Sprintf("Исполнитель: %s (основные раздачи и дискографии)", primaryName),
			CategoryType:    "primary_artist",
			SuggestionTitle: primaryName,
			Count:           len(catPrimaryArtist),
			Results:         catPrimaryArtist,
		})
	}

	if len(catCollabsCovers) > 0 {
		groups = append(groups, VariantGroup{
			Query:           fmt.Sprintf("%s — совместные треки, каверы и трибьюты (feat. / Tribute)", primaryName),
			CategoryType:    "collabs_and_covers",
			SuggestionTitle: primaryName + " (feat. / Cover)",
			Count:           len(catCollabsCovers),
			Results:         catCollabsCovers,
		})
	}

	for _, key := range otherArtistOrder {
		items := otherArtistMap[key]
		if len(items) == 0 {
			continue
		}
		artistDisplay, songDisplay := splitTorrentArtistAndRest(items[0].Title)
		if artistDisplay == "" {
			artistDisplay = key
		}
		if songDisplay == "" {
			songDisplay = rawQuery
		}
		label := fmt.Sprintf("Возможно, вы имели в виду: %s (содержит трек/релиз «%s»)", artistDisplay, primaryName)
		groups = append(groups, VariantGroup{
			Query:           label,
			CategoryType:    "did_you_mean_song_by_other_artist",
			SuggestionTitle: fmt.Sprintf("%s — %s", artistDisplay, songDisplay),
			Count:           len(items),
			Results:         items,
		})
		if len(groups) >= 5 {
			break
		}
	}

	if len(groups) < 3 && len(catPrimaryArtist) > 1 {
		var discographies, losslessAlbums, mp3Releases []TorrentResult
		for _, it := range catPrimaryArtist {
			if matchesFormatFilter(it.Title, "flac") || matchesFormatFilter(it.Title, "wav") {
				losslessAlbums = append(losslessAlbums, it)
			} else {
				mp3Releases = append(mp3Releases, it)
			}
		}
		var expanded []VariantGroup
		if len(discographies) > 0 {
			expanded = append(expanded, VariantGroup{
				Query:           fmt.Sprintf("%s — Дискографии и полные собрания", primaryName),
				CategoryType:    "primary_discography",
				SuggestionTitle: primaryName + " (Дискография)",
				Count:           len(discographies),
				Results:         discographies,
			})
		}
		if len(losslessAlbums) > 0 {
			expanded = append(expanded, VariantGroup{
				Query:           fmt.Sprintf("%s — Альбомы и синглы в Lossless (FLAC / Hi-Res)", primaryName),
				CategoryType:    "primary_lossless",
				SuggestionTitle: primaryName + " (FLAC)",
				Count:           len(losslessAlbums),
				Results:         losslessAlbums,
			})
		}
		if len(mp3Releases) > 0 {
			expanded = append(expanded, VariantGroup{
				Query:           fmt.Sprintf("%s — Отдельные релизы и MP3", primaryName),
				CategoryType:    "primary_mp3_and_other",
				SuggestionTitle: primaryName + " (MP3 / Альбомы)",
				Count:           len(mp3Releases),
				Results:         mp3Releases,
			})
		}
		for _, g := range groups[1:] {
			if len(expanded) < 5 {
				expanded = append(expanded, g)
			}
		}
		if len(expanded) >= 2 {
			groups = expanded
		}
	}

	for i, g := range groups {
		logger.Simple("📂 Категория #%d [%s]: «%s» -> %d раздач", i+1, g.CategoryType, g.Query, g.Count)
	}
	return groups
}

// ============================================================================
// 9.5 НЕБЛОКИРУЮЩИЙ РЕАКТИВНЫЙ ДВИЖОК (ОТДАЧА ПО ФАКТУ ПРИЛЁТА БЕЗ ТАЙМЕРОВ)
// ============================================================================

type liveSearchSession struct {
mu              sync.Mutex
cond            *sync.Cond
updateCh        chan struct{}
key             string
rawQuery        string
cfg             EngineConfig
logger          *SearchLogger
startTime       time.Time
updatedAt       time.Time
ctx             context.Context
cancel          context.CancelFunc

corrected       string
terms           []string
dispatchedTerms map[string]int
termResults     map[int][]TorrentResult
tracks          []ResolvedTrackInfo
scrapedSeeds    map[string][2]int
scrapedAsked    map[string]bool

totalJobs       int
completedJobs   int
catalogRunning  bool
inProgress      bool
version         int
latestSnap      SearchResponse
}

var (
sessionsMu   sync.Mutex
liveSessions = make(map[string]*liveSearchSession)
)

func makeSessionKey(rawQuery string, cfg EngineConfig) string {
return fmt.Sprintf("%s|%s|%v|%v|%.2f",
strings.ToLower(strings.TrimSpace(rawQuery)),
strings.ToLower(strings.TrimSpace(cfg.FormatTag)),
cfg.HideZeroSeeds,
cfg.MinTwoSeeds,
cfg.MinFuzzyScore,
)
}

func (sess *liveSearchSession) notifyUpdate() {
select {
case sess.updateCh <- struct{}{}:
default:
}
}

func (sess *liveSearchSession) snapshotWorker() {
for range sess.updateCh {
// Коалесценция пачки ответов, прилетевших в одно и то же мгновение (25 мс)
time.Sleep(25 * time.Millisecond)
select {
case <-sess.updateCh:
default:
}

// Копируем данные под коротким локом (< 0.05 мс), чтобы /search никогда не блокировался
sess.mu.Lock()
terms := append([]string(nil), sess.terms...)
corrected := sess.corrected
if corrected == "" {
corrected = sess.rawQuery
}
termResultsCopy := make([][]TorrentResult, len(terms))
for idx := range terms {
src := sess.termResults[idx]
cp := make([]TorrentResult, len(src))
copy(cp, src)
termResultsCopy[idx] = cp
}
seedsCopy := make(map[string][2]int, len(sess.scrapedSeeds))
for k, v := range sess.scrapedSeeds {
seedsCopy[k] = v
}
// Для быстрого ранжирования берем только значимые треки (без сотен черновых catalog_candidate)
var relevantTracks []ResolvedTrackInfo
seenAlbumKey := make(map[string]bool)
for _, tr := range sess.tracks {
if tr.Role == "catalog_candidate" {
continue
}
ak := strings.ToLower(tr.Artist + "|" + tr.Album + "|" + tr.Role)
if !seenAlbumKey[ak] && len(relevantTracks) < 25 {
seenAlbumKey[ak] = true
relevantTracks = append(relevantTracks, tr)
}
}
compJobs := sess.completedJobs
totJobs := sess.totalJobs
catRun := sess.catalogRunning
sess.mu.Unlock()

// Тяжелая математика ранжирования выполняется СВОБОДНО БЕЗ МЬЮТЕКСА
mergedMap := make(map[string]TorrentResult)
variantBonus := make(map[string]float64)
bestPower := -1.0
bestVariantName := ""

for idx, tName := range terms {
grp := termResultsCopy[idx]
totalCnt, liveCnt, discoCnt := len(grp), 0, 0
for _, it := range grp {
seeds := it.Seeds
if sp, ok := seedsCopy[it.InfoHash]; ok && sp[0] > seeds {
seeds = sp[0]
}
if seeds > 0 {
liveCnt++
}
if isDiscographyOrCollection(it.Title) {
discoCnt++
}
}
stepPriorityBonus := float64(20-idx) * 1.2
if stepPriorityBonus < 0 {
stepPriorityBonus = 0
}
power := float64(totalCnt)*1.5 + float64(liveCnt)*3.0 + float64(discoCnt)*20.0 + stepPriorityBonus*2.0
bonus := math.Log1p(float64(liveCnt))*10.0 + float64(discoCnt)*8.0 + stepPriorityBonus
if bonus > 75.0 {
bonus = 75.0
}
variantBonus[tName] = bonus
if power > bestPower && totalCnt > 0 && matchWithinTwoLettersNoSymbols(tName, sess.rawQuery) {
bestPower = power
bestVariantName = tName
}
}
if bestVariantName != "" && bestVariantName != corrected {
corrected = bestVariantName
}

for idx := range terms {
for _, it := range termResultsCopy[idx] {
if sp, ok := seedsCopy[it.InfoHash]; ok {
if sp[0] > it.Seeds {
it.Seeds = sp[0]
}
if sp[1] > it.Peers {
it.Peers = sp[1]
}
}
it.FinalRank = variantBonus[it.MatchedVia]
if ex, ok := mergedMap[it.InfoHash]; !ok || it.Seeds > ex.Seeds || it.FinalRank > ex.FinalRank {
mergedMap[it.InfoHash] = it
}
}
}

var allItems []TorrentResult
for _, it := range mergedMap {
allItems = append(allItems, it)
}

ranked, hiddenZero := rankAndFilter(allItems, sess.rawQuery, corrected, terms, relevantTracks, sess.cfg, sess.logger)
groups := buildSmartCategoryGroups(ranked, sess.rawQuery, corrected, terms, relevantTracks, sess.logger)

// Мгновенно записываем готовый снимок под локом (< 0.01 мс)
sess.mu.Lock()
if bestVariantName != "" {
sess.corrected = bestVariantName
}
sess.version++
sess.updatedAt = time.Now()
sess.inProgress = sess.catalogRunning || (sess.completedJobs < sess.totalJobs)
sess.latestSnap = SearchResponse{
Status:          "ok",
InProgress:      sess.inProgress,
SnapshotVersion: sess.version,
CompletedJobs:   sess.completedJobs,
TotalJobs:       sess.totalJobs,
OriginalQuery:   sess.rawQuery,
CorrectedQuery:  corrected,
ResolvedTracks:  relevantTracks,
ExpandedTerms:   terms,
ElapsedMs:       time.Since(sess.startTime).Milliseconds(),
TotalFound:      len(ranked),
HiddenZero:      hiddenZero,
Groups:          groups,
Results:         ranked,
}
doneNow := !sess.inProgress && !catRun && compJobs >= totJobs
sess.cond.Broadcast()
sess.mu.Unlock()

if doneNow {
sess.logger.Simple("🏁 Все индексаторы завершили работу за %d мс (итого раздач: %d)",
time.Since(sess.startTime).Milliseconds(), len(ranked))
sess.logger.Flush()
}
}
}

func (sess *liveSearchSession) triggerAsyncUDPScrapeLocked(items []TorrentResult) {
if !sess.cfg.EnableUDP {
return
}
var newHashes [][]byte
for _, r := range items {
h := strings.ToLower(r.InfoHash)
if len(h) == 40 && !sess.scrapedAsked[h] {
if b, err := hex.DecodeString(h); err == nil && len(b) == 20 {
sess.scrapedAsked[h] = true
newHashes = append(newHashes, b)
}
}
}
if len(newHashes) == 0 {
return
}
for _, tr := range udpTrackers {
sess.totalJobs++
go func(trackerAddr string, hashes [][]byte) {
res := udpScrapeSingleTracker(trackerAddr, hashes, sess.logger)
sess.mu.Lock()
sess.completedJobs++
changed := false
for h, sp := range res {
cur := sess.scrapedSeeds[h]
if sp[0] > cur[0] || sp[1] > cur[1] {
if sp[0] > cur[0] {
cur[0] = sp[0]
}
if sp[1] > cur[1] {
cur[1] = sp[1]
}
sess.scrapedSeeds[h] = cur
changed = true
}
}
sess.inProgress = sess.catalogRunning || (sess.completedJobs < sess.totalJobs)
done := !sess.inProgress
sess.mu.Unlock()
if changed || done {
sess.notifyUpdate()
}
}(tr, newHashes)
}
}

func (sess *liveSearchSession) dispatchVariantLocked(variant string) {
vClean := strings.Join(strings.Fields(strings.TrimSpace(variant)), " ")
if vClean == "" {
return
}
vKey := strings.ToLower(vClean)
if _, exists := sess.dispatchedTerms[vKey]; exists {
return
}
if len(sess.terms) >= 20 {
return
}
slotIdx := len(sess.terms)
sess.terms = append(sess.terms, vClean)
sess.dispatchedTerms[vKey] = slotIdx

var jobs []searchJob
jobs = append(jobs,
searchJob{name: "Rutor", fn: searchRutorDoH, arg: vClean},
searchJob{name: "Knaben", fn: searchKnaben, arg: vClean},
searchJob{name: "RuTracker(TorAPI)", fn: searchTorAPIRuTracker, arg: vClean},
searchJob{name: "SolidTorrents", fn: searchSolidTorrents, arg: vClean},
searchJob{name: "BitSearch", fn: searchBitsearch, arg: vClean},
searchJob{name: "ApiBay", fn: searchApiBay, arg: vClean},
searchJob{name: "Seeker(Soulseek)", fn: searchSoulseekSeeker, arg: vClean},
)
if strings.Contains(vClean, "/") {
cleanSlash := strings.Join(strings.Fields(strings.ReplaceAll(vClean, "/", " ")), " ")
jobs = append(jobs,
searchJob{name: "Rutor", fn: searchRutorDoH, arg: cleanSlash},
searchJob{name: "BitSearch", fn: searchBitsearch, arg: cleanSlash},
searchJob{name: "Knaben", fn: searchKnaben, arg: cleanSlash},
)
}

sess.totalJobs += len(jobs)
for _, job := range jobs {
go func(j searchJob, idx int, matchedTerm string) {
items := j.fn(sess.ctx, j.arg, sess.logger)
sess.mu.Lock()
sess.completedJobs++
if len(items) > 0 {
top := items[0]
sess.logger.Simple("⚡ [Поток] Индексатор [%s] по «%s» прислал %d раздач (топ: «%s», ▲%d)",
j.name, j.arg, len(items), top.Title, top.Seeds)
existing := sess.termResults[idx]
byHash := make(map[string]int, len(existing))
for i, ex := range existing {
byHash[strings.ToLower(ex.InfoHash)] = i
}
for _, it := range items {
it.MatchedVia = matchedTerm
h := strings.ToLower(it.InfoHash)
if pos, ok := byHash[h]; ok {
if it.Seeds > existing[pos].Seeds {
existing[pos] = it
}
} else {
byHash[h] = len(existing)
existing = append(existing, it)
}
}
sess.termResults[idx] = existing
sess.triggerAsyncUDPScrapeLocked(items)
}
sess.inProgress = sess.catalogRunning || (sess.completedJobs < sess.totalJobs)
done := !sess.inProgress
sess.mu.Unlock()
if len(items) > 0 || done {
sess.notifyUpdate()
}
}(job, slotIdx, vClean)
}
}

func startOrGetLiveSession(rawQuery string, cfg EngineConfig, forceNew bool) *liveSearchSession {
key := makeSessionKey(rawQuery, cfg)
sessionsMu.Lock()
if !forceNew {
if ex, ok := liveSessions[key]; ok {
ex.mu.Lock()
age := time.Since(ex.startTime)
stillValid := ex.inProgress || age < 3*time.Minute
ex.mu.Unlock()
if stillValid {
sessionsMu.Unlock()
return ex
}
}
}

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
logger := newSearchLogger(rawQuery, cfg)
sess := &liveSearchSession{
updateCh:        make(chan struct{}, 1),
key:             key,
rawQuery:        rawQuery,
cfg:             cfg,
logger:          logger,
startTime:       time.Now(),
updatedAt:       time.Now(),
ctx:             ctx,
cancel:          cancel,
corrected:       rawQuery,
dispatchedTerms: make(map[string]int),
termResults:     make(map[int][]TorrentResult),
scrapedSeeds:    make(map[string][2]int),
scrapedAsked:    make(map[string]bool),
catalogRunning:  true,
inProgress:      true,
latestSnap: SearchResponse{
Status:        "ok",
InProgress:    true,
OriginalQuery: rawQuery,
},
}
sess.cond = sync.NewCond(&sess.mu)
liveSessions[key] = sess
sessionsMu.Unlock()

go sess.snapshotWorker()

// ВОЛНА 0 (0 мс): Мгновенный старт по исходному запросу и быстрым фонетическим вариантам
sess.mu.Lock()
qClean := strings.Join(strings.Fields(strings.TrimSpace(rawQuery)), " ")
sess.dispatchVariantLocked(qClean)
if !hasVowels(qClean) && len([]rune(qClean)) >= 2 {
if hasCyrillic(qClean) {
sess.dispatchVariantLocked(kbdRuToEn.Replace(qClean))
} else {
sess.dispatchVariantLocked(kbdEnToRu.Replace(qClean))
}
}
if cfg.EnablePhonetic {
fastAnglo := ruAngloPhoneticVariants(qClean, nil)
for i := 0; i < len(fastAnglo) && i < 2; i++ {
sess.dispatchVariantLocked(fastAnglo[i])
}
}
sess.mu.Unlock()
sess.notifyUpdate()

// ВОЛНА 1..N: Фоновое подключение SoundCloud и каталогов по мере готовности
go func() {
catCtx, catCancel := context.WithTimeout(sess.ctx, 3500*time.Millisecond)
terms, corrected, tracks := buildExpandedQueries(catCtx, rawQuery, cfg, logger)
catCancel()

sess.mu.Lock()
if corrected != "" {
sess.corrected = corrected
}
sess.tracks = tracks
for _, t := range terms {
sess.dispatchVariantLocked(t)
}
sess.catalogRunning = false
sess.inProgress = sess.completedJobs < sess.totalJobs
sess.mu.Unlock()
sess.notifyUpdate()
}()

return sess
}

func executeOmniSearchWithConfig(rawQuery string, cfg EngineConfig) SearchResponse {
sess := startOrGetLiveSession(rawQuery, cfg, cfg.ForceNew)
sess.mu.Lock()
defer sess.mu.Unlock()

// Если раздачи уже есть в снимке — отдаем за 0 мс!
// Если это самый первый запрос (0 раздач), ждем прилета первой раздачи максимум 700 мс и сразу отдаем ответ UI
if sess.latestSnap.TotalFound == 0 && sess.inProgress {
doneWait := make(chan struct{})
go func() {
time.Sleep(700 * time.Millisecond)
close(doneWait)
sess.cond.Broadcast()
}()
for sess.latestSnap.TotalFound == 0 && sess.inProgress {
select {
case <-doneWait:
return sess.latestSnap
default:
sess.cond.Wait()
}
}
}
return sess.latestSnap
}

func cleanTitle(s string) string {
	s = reHTMLTags.ReplaceAllString(s, "")
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func extractInfoHash(magnet string) string {
	if m := reBtih.FindStringSubmatch(magnet); len(m) >= 2 {
		return strings.ToLower(m[1])
	}
	return ""
}

func extractNameFromMagnet(magnet string) string {
	u, err := url.Parse(magnet)
	if err != nil {
		return ""
	}
	return u.Query().Get("dn")
}

func buildMagnet(infoHash, title string) string {
	var trBuilder strings.Builder
	for _, tr := range udpTrackers {
		trBuilder.WriteString("&tr=")
		trBuilder.WriteString(url.QueryEscape("udp://" + tr + "/announce"))
	}
	return fmt.Sprintf("magnet:?xt=urn:btih:%s&dn=%s%s", infoHash, url.QueryEscape(title), trBuilder.String())
}

func formatBytes(b int64) string {
	if b <= 0 {
		return "0 MB"
	}
	if b < 1024 {
		return fmt.Sprintf("%d B", b)
	}
	const unit = 1024
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func parseBoolParam(val string, def bool) bool {
	val = strings.TrimSpace(strings.ToLower(val))
	switch val {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}

func applyQueryOverrides(q url.Values, cfg *EngineConfig) {
	if v := q.Get("force_new"); v != "" {
		cfg.ForceNew = parseBoolParam(v, cfg.ForceNew)
	}
	if ft := strings.TrimSpace(q.Get("format_tag")); ft != "" {
		cfg.FormatTag = strings.ToLower(ft)
	}
	if v := q.Get("enable_soundcloud"); v != "" {
		cfg.EnableSoundCloud = parseBoolParam(v, cfg.EnableSoundCloud)
	}
	if v := strings.TrimSpace(q.Get("soundcloud_client_id")); v != "" {
		cfg.SoundCloudClientID = v
	}
	if v := q.Get("disable_logs"); v != "" {
		cfg.DisableLogs = parseBoolParam(v, cfg.DisableLogs)
	}
	if v := q.Get("enable_logs"); v != "" {
		cfg.DisableLogs = !parseBoolParam(v, !cfg.DisableLogs)
	}
	if v := q.Get("simple_log"); v != "" {
		cfg.EnableSimpleLog = parseBoolParam(v, cfg.EnableSimpleLog)
	}
	if v := q.Get("enable_simple_log"); v != "" {
		cfg.EnableSimpleLog = parseBoolParam(v, cfg.EnableSimpleLog)
	}
	if v := q.Get("trace_log"); v != "" {
		cfg.EnableTraceLog = parseBoolParam(v, cfg.EnableTraceLog)
	}
	if v := q.Get("enable_trace_log"); v != "" {
		cfg.EnableTraceLog = parseBoolParam(v, cfg.EnableTraceLog)
	}
	if v := strings.TrimSpace(q.Get("log_dir")); v != "" {
		cfg.LogDir = v
	}
	if v := strings.TrimSpace(q.Get("simple_log_path")); v != "" {
		cfg.SimpleLogPath = v
	}
	if v := strings.TrimSpace(q.Get("trace_log_path")); v != "" {
		cfg.TraceLogPath = v
	}
}

func StartOmniHTTPServer(addr string) error {
go func() {
_ = resolveRutorIP(nil)
configMu.RLock()
cfg := defaultConfig
configMu.RUnlock()
_ = resolveSoundCloudClientID(context.Background(), cfg, nil)
}()

mux := http.NewServeMux()

mux.HandleFunc("/search/stream", func(w http.ResponseWriter, r *http.Request) {
w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
w.Header().Set("Cache-Control", "no-cache")
w.Header().Set("Connection", "keep-alive")
w.Header().Set("Access-Control-Allow-Origin", "*")
flusher, ok := w.(http.Flusher)
if !ok {
http.Error(w, "streaming unsupported", http.StatusInternalServerError)
return
}
configMu.RLock()
cfg := defaultConfig
configMu.RUnlock()
q := strings.TrimSpace(r.URL.Query().Get("q"))
applyQueryOverrides(r.URL.Query(), &cfg)
forceNew := parseBoolParam(r.URL.Query().Get("force_new"), false)

sess := startOrGetLiveSession(q, cfg, forceNew)
lastVer := -1
for {
sess.mu.Lock()
for sess.version == lastVer && sess.inProgress {
sess.cond.Wait()
}
snap := sess.latestSnap
lastVer = sess.version
stillRunning := sess.inProgress
sess.mu.Unlock()

b, _ := json.Marshal(snap)
_, err := fmt.Fprintf(w, "data: %s\n\n", string(b))
if err != nil {
return
}
flusher.Flush()
if !stillRunning {
return
}
}
})

mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","version":"3.2-ir"}`))
	})

	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		configMu.Lock()
		defer configMu.Unlock()

		applyQueryOverrides(r.URL.Query(), &defaultConfig)
		if r.Method == http.MethodPost {
			if body, err := io.ReadAll(r.Body); err == nil && len(body) > 0 {
				_ = json.Unmarshal(body, &defaultConfig)
			}
		}
		simplePath, tracePath := resolveLogPaths(defaultConfig)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":               "ok",
			"config":               defaultConfig,
			"resolved_simple_path": simplePath,
			"resolved_trace_path":  tracePath,
		})
	})

	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		go func() {
			time.Sleep(150 * time.Millisecond)
			os.Exit(0)
		}()
	})

	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				_ = json.NewEncoder(w).Encode(map[string]string{
					"status": "error",
					"error":  fmt.Sprintf("recovered panic: %v", rec),
				})
			}
		}()

		configMu.RLock()
		cfg := defaultConfig
		configMu.RUnlock()

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		applyQueryOverrides(r.URL.Query(), &cfg)

		if r.Method == http.MethodPost {
			if body, err := io.ReadAll(r.Body); err == nil && len(body) > 0 {
				var reqBody struct {
					Q     string `json:"q"`
					Query string `json:"query"`
					ForceNew bool `json:"force_new"`
					EngineConfig
				}
				reqBody.EngineConfig = cfg
				if json.Unmarshal(body, &reqBody) == nil {
					if reqBody.Query == "" {
						reqBody.Query = reqBody.Q
					}
					if reqBody.Query != "" {
						q = reqBody.Query
					}
					cfg = reqBody.EngineConfig
				}
			}
		}

		res := executeOmniSearchWithConfig(q, cfg)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(res)
	})

	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
	}
	return srv.ListenAndServe()
}

func main() {
	addrFlag := flag.String("addr", "127.0.0.1:18998", "HTTP listen address")
	serveFlag := flag.String("serve", "", "Legacy serve address")
	noLogsFlag := flag.Bool("no-logs", false, "Disable both logs")
	simpleLogFlag := flag.Bool("simple-log", true, "Enable human-readable step log")
	traceLogFlag := flag.Bool("trace-log", true, "Enable full technical trace log")
	logDirFlag := flag.String("log-dir", "", "Directory for omni_simple.log and omni_full_trace.log")
	simplePathFlag := flag.String("simple-log-path", "", "Exact file path for simple log")
	tracePathFlag := flag.String("trace-log-path", "", "Exact file path for full trace log")
	scClientFlag := flag.String("sc-client-id", "", "Optional SoundCloud client_id override")
	flag.Parse()

	configMu.Lock()
	if *noLogsFlag {
		defaultConfig.DisableLogs = true
	}
	defaultConfig.EnableSimpleLog = *simpleLogFlag
	defaultConfig.EnableTraceLog = *traceLogFlag
	if *logDirFlag != "" {
		defaultConfig.LogDir = *logDirFlag
	}
	if *simplePathFlag != "" {
		defaultConfig.SimpleLogPath = *simplePathFlag
	}
	if *tracePathFlag != "" {
		defaultConfig.TraceLogPath = *tracePathFlag
	}
	if *scClientFlag != "" {
		defaultConfig.SoundCloudClientID = *scClientFlag
	}
	cfg := defaultConfig
	configMu.Unlock()

	args := flag.Args()
	if *serveFlag != "" {
		*addrFlag = *serveFlag
		args = nil
	}
	if len(args) > 0 {
		q := strings.Join(args, " ")
		res := executeOmniSearchWithConfig(q, cfg)
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(res)
		return
	}
	_ = StartOmniHTTPServer(*addrFlag)
}