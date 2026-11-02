package main


import (
  "bytes"
  "context"
  "crypto/tls"
  "encoding/binary"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "math"
  "math/rand"
  "net"
  "net/http"
  "net/url"
  "regexp"
  "sort"
  "strconv"
  "strings"
  "sync"
  "time"
  "unicode"
  "os"
)

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

type ResolvedTrackInfo struct {
  Artist string `json:"artist"`
  Track  string `json:"track"`
  Album  string `json:"album"`
}

type VariantGroup struct {
  Query   string          `json:"query"`
  Count   int             `json:"count"`
  Results []TorrentResult `json:"results"`
}

type SearchResponse struct {
  Status         string              `json:"status"`
  OriginalQuery  string              `json:"original_query"`
  CorrectedQuery string              `json:"corrected_query"`
  ResolvedTracks []ResolvedTrackInfo `json:"resolved_tracks,omitempty"`
  ExpandedTerms  []string            `json:"expanded_terms"`
  ElapsedMs      int64               `json:"elapsed_ms"`
  TotalFound     int                 `json:"total_found"`
  HiddenZero     int                 `json:"hidden_zero"`
  Groups         []VariantGroup      `json:"groups"`
  Results        []TorrentResult     `json:"results"`
}

type EngineConfig struct {
  TimeoutMs      int     `json:"timeout_ms"`
  PreferAudio    bool    `json:"prefer_audio"`
  Profile        string  `json:"profile"`         // "audio", "video", "omni" (переключение на лету)
  EnablePhonetic bool    `json:"enable_phonetic"` // Модуль фонетики/транслита на лету
  EnableCatalog  bool    `json:"enable_catalog"`  // Модуль Песня->Артист на лету
  EnableUDP      bool    `json:"enable_udp"`      // Модуль живого UDP-радара на лету
  FormatTag      string  `json:"format_tag"`
  Year           string  `json:"year"`
  ExactMatch     bool    `json:"exact"`
  HideZeroSeeds  bool    `json:"hide_zero"`
  MinTwoSeeds    bool    `json:"min_two_seeds"`
  MinFuzzyScore  float64 `json:"min_fuzzy_score"`
}

var (
  cfgMu        sync.RWMutex
  globalConfig = EngineConfig{
    TimeoutMs:      10000,
    PreferAudio:    true,
    Profile:        "audio",
    EnablePhonetic: true,
    EnableCatalog:  true,
    EnableUDP:      true,
    FormatTag:      "all",
    ExactMatch:     false,
    HideZeroSeeds:  true,
    MinTwoSeeds:    false,
    MinFuzzyScore:  0.52,
  }

  httpClient = &http.Client{
    Timeout: 8500 * time.Millisecond,
    Transport: &http.Transport{
      TLSClientConfig:   &tls.Config{InsecureSkipVerify: true},
      DisableKeepAlives: false,
      MaxIdleConns:      30,
      IdleConnTimeout:   30 * time.Second,
    },
  }

  rutorCacheMu  sync.RWMutex
  rutorCachedIP = "193.46.255.29"
  rutorCacheTS  time.Time

  infoHashRegex  = regexp.MustCompile(`(?i)btih:([a-f0-9]{40})`)
  htmlTagRegex   = regexp.MustCompile(`<[^>]*>`)
  videoJunkRegex = regexp.MustCompile(`(?i)(web-?dl|web-?bl|webrip|bdrip|bdremux|brrip|hdrip|hdtv|dvdrip|dvd5|dvd9|satrip|tvrip|camrip|1080[pi]|720p|2160p|x264|x265|hevc|avc|blu-?ray|\bкпк\b|\bсезон\b|\bсерии\b|\bfb2\b|\bpdf\b|\brtf\b|\bepub\b|\bmobi\b|\bdjvu\b|\bdoc\b|pc\s+by|repack|\bapk\b|аудиокниг|радиоспектакл|видеокурс|курс\s+иллюзионист|полезных\s+привыч|нанопривыч|силовые\s+упражн|\[клип\]|видеоклип)`)
  audioGoodRegex = regexp.MustCompile(`(?i)\b(flac|mp3|wav|lossless|alac|m4a|aac|ape|wv|ogg|opus|320\s*kbps|320kbps|24bit|16bit|hi-?res|discography|дискография|альбом|сборник|коллекция|collection|anthology|ost|soundtrack)\b`)
)

var enToRuLayout = strings.NewReplacer(
  "q", "й", "w", "ц", "e", "у", "r", "к", "t", "е", "y", "н", "u", "г", "i", "ш", "o", "щ", "p", "з", "[", "х", "]", "ъ",
  "a", "ф", "s", "ы", "d", "в", "f", "а", "g", "п", "h", "р", "j", "о", "k", "л", "l", "д", ";", "ж", "'", "э",
  "z", "я", "x", "ч", "c", "с", "v", "м", "b", "и", "n", "т", "m", "ь", ",", "б", ".", "ю",
)

var ruToEnLayout = strings.NewReplacer(
  "й", "q", "ц", "w", "у", "e", "к", "r", "е", "t", "н", "y", "г", "u", "ш", "i", "щ", "o", "з", "p", "х", "[", "ъ", "]",
  "ф", "a", "ы", "s", "в", "d", "а", "f", "п", "g", "р", "h", "о", "j", "л", "k", "д", "l", "ж", ";", "э", "'",
  "я", "z", "ч", "x", "с", "c", "м", "v", "и", "b", "т", "n", "ь", "m", "б", ",", "ю", ".",
)

var ruToEnTranslit = strings.NewReplacer(
  "щ", "shch", "ш", "sh", "ч", "ch", "ц", "ts", "ж", "zh", "х", "kh", "ё", "e", "ю", "yu", "я", "ya",
  "а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "y",
  "к", "k", "л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t",
  "у", "u", "ф", "f", "ъ", "", "ы", "y", "ь", "", "э", "e",
)

var ruToEnAltTranslit = strings.NewReplacer(
  "щ", "sch", "ш", "sh", "ч", "ch", "ц", "c", "ж", "j", "х", "h", "ё", "e", "ю", "u", "я", "ia",
  "а", "a", "б", "b", "в", "w", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "i",
  "к", "c", "л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t",
  "у", "u", "ф", "f", "ъ", "", "ы", "i", "ь", "", "э", "e",
)

var enToRuTranslit = strings.NewReplacer(
  "shch", "щ", "sch", "щ", "zh", "ж", "kh", "х", "ts", "ц", "ch", "ч", "sh", "ш", "yu", "ю", "ya", "я", "yo", "ё",
  "ck", "к", "ph", "ф", "th", "т",
  "a", "а", "b", "б", "v", "в", "w", "в", "g", "г", "d", "д", "e", "е", "z", "з", "i", "и", "y", "й",
  "k", "к", "c", "к", "q", "к", "l", "л", "m", "м", "n", "н", "o", "о", "p", "п", "r", "р", "s", "с",
  "t", "т", "u", "у", "f", "ф", "h", "х", "j", "дж", "x", "кс",
)

func hasVowels(s string) bool {
  for _, r := range s {
    if strings.ContainsRune("аеёиоуыэюяaeiouy", r) {
      return true
    }
  }
  return false
}

func hasCyrillic(s string) bool {
  for _, r := range s {
    if (r >= 'а' && r <= 'я') || r == 'ё' || (r >= 'А' && r <= 'Я') || r == 'Ё' {
      return true
    }
  }
  return false
}

func phoneticSkeleton(s string) string {
  s = strings.ToLower(s)
  s = ruToEnTranslit.Replace(s)
  phoneticMap := strings.NewReplacer(
    "shch", "S", "sch", "S", "sh", "S", "ch", "C", "ts", "C", "zh", "S", "kh", "h", "ph", "f", "ck", "k",
    "c", "k", "q", "k", "x", "ks", "w", "v",
    "b", "p", "d", "t", "g", "k", "z", "s", "v", "f",
    "a", "", "e", "", "i", "", "o", "", "u", "", "y", "", "h", "",
  )
  s = strings.ToLower(phoneticMap.Replace(s))
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

func stemWord(w string) string {
  runes := []rune(w)
  if len(runes) <= 4 {
    return w
  }
  suffixes := []string{
    "ами", "ями", "ого", "его", "ому", "ему", "ую", "юю", "ая", "яя", "ое", "ее", "ые", "ие",
    "ов", "ев", "ей", "ам", "ям", "ах", "ях", "ом", "ем", "ой", "ою", "ий", "ый",
    "ing", "ed", "es", "s", "а", "я", "о", "е", "ы", "и", "у", "ю",
  }
  for _, suf := range suffixes {
    if strings.HasSuffix(w, suf) {
      trimmed := strings.TrimSuffix(w, suf)
      if len([]rune(trimmed)) >= 3 {
        return trimmed
      }
    }
  }
  return w
}

func makeTrigrams(s string) map[string]bool {
  padded := "  " + s + " "
  runes := []rune(padded)
  res := make(map[string]bool)
  for i := 0; i <= len(runes)-3; i++ {
    res[string(runes[i:i+3])] = true
  }
  return res
}

func trigramSimilarity(a, b string) float64 {
  g1 := makeTrigrams(a)
  g2 := makeTrigrams(b)
  if len(g1) == 0 || len(g2) == 0 {
    return 0
  }
  matches := 0
  for k := range g1 {
    if g2[k] {
      matches++
    }
  }
  return (2.0 * float64(matches)) / float64(len(g1)+len(g2))
}

func damerauLevenshtein(a, b string) int {
  r1, r2 := []rune(a), []rune(b)
  n, m := len(r1), len(r2)
  if n == 0 {
    return m
  }
  if m == 0 {
    return n
  }
  d := make([][]int, n+1)
  for i := range d {
    d[i] = make([]int, m+1)
    d[i][0] = i
  }
  for j := 0; j <= m; j++ {
    d[0][j] = j
  }
  for i := 1; i <= n; i++ {
    for j := 1; j <= m; j++ {
      cost := 0
      if r1[i-1] != r2[j-1] {
        cost = 1
      }
      val := d[i-1][j] + 1
      if d[i][j-1]+1 < val {
        val = d[i][j-1] + 1
      }
      if d[i-1][j-1]+cost < val {
        val = d[i-1][j-1] + cost
      }
      if i > 1 && j > 1 && r1[i-1] == r2[j-2] && r1[i-2] == r2[j-1] {
        if d[i-2][j-2]+cost < val {
          val = d[i-2][j-2] + cost
        }
      }
      d[i][j] = val
    }
  }
  return d[n][m]
}

func normalizeCompact(s string) string {
  s = strings.ToLower(ruToEnTranslit.Replace(s))
  var out []rune
  for _, r := range s {
    if unicode.IsLetter(r) || unicode.IsDigit(r) {
      out = append(out, r)
    }
  }
  return string(out)
}

var (
featGuestRe   = regexp.MustCompile(`(?i)(?:\b(feat\.?|ft\.?|feature|featuring|with|prod\.?\s*by|vs\.?|при\s*уч\.?|при\s*участии|уч\.?|совм\.?|совместно\s*с)\b|\s+&\s+)`)
suggestJunkRe = regexp.MustCompile(`(?i)\b(music|lyrics|official|video|audio|hd|клип|слушать|текст|скачать|торрент)\b`)
bookJunkRe    = regexp.MustCompile(`(?i)(\bfitgirl\b|\brepack\b|pc\s*\||\|\s*pc\b|\(\d{4}\)\s*pc\b|\bdlc\b|\[v\s*\d+\.\d+|\bfb2\b|\bpdf\b|\brtf\b|\bepub\b|\bmobi\b|\bdjvu\b|аудиокниг|радиоспектакл|\[книг|\bкнига\s*\d|\bкниги\s*\d|\bтом\s*\d|vhsrip|iptv|satremux|50\s*fps|курс\s+иллюзионист|полезных\s+привыч|нанопривыч|силовые\s+упражн|pc\s+by)`)
)

func compactRawLetters(s string) string {
s = strings.ReplaceAll(strings.ToLower(s), "ё", "е")
var out []rune
for _, r := range s {
if unicode.IsLetter(r) || unicode.IsDigit(r) {
out = append(out, r)
}
}
return string(out)
}

func absInt(x int) int {
if x < 0 {
return -x
}
return x
}

var enAlpha = [][2]string{
{"даблю", "w"}, {"джей", "j"}, {"джэй", "j"}, {"эйч", "h"}, {"кью", "q"}, {"экс", "x"}, {"икс", "x"},
{"зет", "z"}, {"зэт", "z"}, {"вай", "y"}, {"уай", "y"}, {"кей", "k"}, {"кэй", "k"}, {"джи", "g"},
{"эй", "a"}, {"ей", "a"}, {"би", "b"}, {"си", "c"}, {"ди", "d"}, {"эф", "f"}, {"ай", "i"},
{"эл", "l"}, {"эм", "m"}, {"эн", "n"}, {"оу", "o"}, {"пи", "p"}, {"ар", "r"}, {"эс", "s"},
{"ти", "t"}, {"ви", "v"}, {"зи", "z"}, {"зе", "z"}, {"ю", "u"}, {"и", "e"},
}

var g2pReplacer = strings.NewReplacer(
"дж", "j", "тч", "ch", "ч", "ch", "ш", "sh", "щ", "sh", "кс", "x", "кв", "qu", "кью", "cu", "ью", "u",
"ей", "ay", "эй", "ay", "ай", "i", "ой", "oy", "ау", "ow", "оу", "o", "я", "ya", "ю", "u",
"а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "з", "z", "и", "i", "й", "y",
"к", "k", "л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t",
"у", "u", "ф", "f", "х", "h", "ц", "ts", "ы", "y", "ъ", "", "ь", "",
)

func decodeSpelledLetters(s string) []string {
comp := compactRawLetters(strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(s), "э", "е"), "ё", "е"))
if len([]rune(comp)) < 3 || len([]rune(comp)) > 16 {
return nil
}
var lets []string
for rem := comp; len(rem) > 0; {
hit := false
for _, kv := range enAlpha {
if strings.HasPrefix(rem, kv[0]) {
lets = append(lets, kv[1])
rem = strings.TrimPrefix(rem, kv[0])
hit = true
break
}
}
if !hit {
return nil
}
}
if len(lets) < 2 || len(lets) > 6 {
return nil
}
joinedCompact := strings.ToUpper(strings.Join(lets, ""))
res := []string{joinedCompact}
if len(lets) == 4 {
res = append(res, strings.ToUpper(lets[0]+lets[1]+" "+lets[2]+lets[3]))
}
if lets[0] == "j" && len(lets) == 2 {
res = append([]string{"Jay-" + strings.ToUpper(lets[1])}, res...)
}
return res
}

// Если однословный запрос начинается со стыка двух согласных (например "xcube"),
// возвращает также вариант без первой опечаточной согласной ("cube")
func stripLeadingConsonantCluster(s string) string {
r := []rune(strings.ToLower(strings.TrimSpace(s)))
if len(r) < 5 || strings.ContainsRune(s, ' ') {
return ""
}
vowels := "аеёиоуыэюяaeiouy"
if !strings.ContainsRune(vowels, r[0]) && !strings.ContainsRune(vowels, r[1]) && strings.ContainsRune(vowels, r[2]) {
if r[0] == 'x' || r[0] == 'k' || r[0] == 'v' || r[0] == 'z' || r[0] == 'q' {
return string(r[1:])
}
}
return ""
}

func ruAngloPhoneticVariants(raw string) []string {
s := strings.ToLower(strings.TrimSpace(raw))
if s == "" {
return nil
}
var out []string
add := func(v string) {
v = strings.Join(strings.Fields(strings.TrimSpace(v)), " ")
if len(v) >= 2 {
for _, ex := range out {
if strings.EqualFold(ex, v) {
return
}
}
out = append(out, v)
}
}
for _, sp := range decodeSpelledLetters(s) {
add(sp)
}
if trimmed := stripLeadingConsonantCluster(s); trimmed != "" {
add(trimmed)
}
norm := strings.ReplaceAll(strings.ReplaceAll(s, "э", "е"), "ё", "е")
g2p := g2pReplacer.Replace(norm)
add(g2p)
// В немецкой/английской транскрипции русское "шт" соответствует и "sht", и "st" (Моргенштерн <-> Morgenstern, Раммштайн <-> Rammstein)
if strings.Contains(g2p, "sht") {
add(strings.ReplaceAll(g2p, "sht", "st"))
}
add(ruToEnTranslit.Replace(norm))
return out
}

func matchStringsIR(query string, target string) (bool, int) {
qForms := []string{compactRawLetters(query), normalizeCompact(query)}
for _, ap := range ruAngloPhoneticVariants(query) {
qForms = append(qForms, normalizeCompact(ap), compactRawLetters(ap))
}
tForms := []string{compactRawLetters(target), normalizeCompact(target)}
qSkel := phoneticSkeleton(query)
tSkel := phoneticSkeleton(target)
bestDist, matched := 999, false

for _, qf := range qForms {
qLen := len([]rune(qf))
if qLen == 0 {
continue
}
for _, tf := range tForms {
tLen := len([]rune(tf))
if tLen == 0 {
continue
}
dist := damerauLevenshtein(qf, tf)
dice := trigramSimilarity(qf, tf)
if qLen >= 5 && tLen >= 5 && absInt(qLen-tLen) <= 3 {
if len(qSkel) >= 4 && damerauLevenshtein(qSkel, tSkel) <= 1 && dist > 1 {
dist = 1
} else if dice >= 0.72 && dist > 2 {
dist = 2
}
}
maxAllowed := 2
if qLen <= 3 || tLen <= 3 {
maxAllowed = 0
} else if qLen == 4 || tLen == 4 {
if absInt(qLen-tLen) <= 1 {
maxAllowed = 1
} else {
maxAllowed = 0
}
}
if dist <= maxAllowed && dist < bestDist {
bestDist, matched = dist, true
}
}
}
return matched, bestDist
}

func matchWithinTwoLettersNoSymbols(query string, target string) (bool, int) {
if ok, d := matchStringsIR(query, target); ok {
return true, d
}
qToks, tToks := tokenize(strings.ToLower(query)), tokenize(strings.ToLower(target))
if len(qToks) == 1 && len([]rune(qToks[0])) >= 4 && len(tToks) >= 2 && len(tToks) <= 3 {
for _, tw := range tToks {
if len([]rune(tw)) >= 4 {
if ok, d := matchStringsIR(qToks[0], tw); ok && d <= 1 {
return true, d
}
}
}
}
return false, 999
}

func positionalPriorityMultiplier(queryVariant string, title string) float64 {
qComp := normalizeCompact(queryVariant)
if len(qComp) < 1 {
return 1.0
}
tLow := strings.ToLower(ruToEnTranslit.Replace(title))
if loc := featGuestRe.FindStringIndex(tLow); loc != nil {
if !strings.Contains(normalizeCompact(tLow[:loc[0]]), qComp) && strings.Contains(normalizeCompact(tLow[loc[0]:]), qComp) {
return 0.42
}
}
headPart := tLow
for _, sep := range []string{" - ", " – ", " — ", ": "} {
if idx := strings.Index(tLow, sep); idx > 0 {
headPart = tLow[:idx]
break
}
}
headComp := normalizeCompact(headPart)
if headComp == qComp || strings.HasPrefix(headComp, qComp) {
return 1.28
}
if strings.Contains(headComp, qComp) {
return 1.18
}
return 1.0
}

func bestTokenSimInField(qt string, fieldTokens []string) float64 {
qLen := len([]rune(qt))
qSkel := phoneticSkeleton(qt)
best := 0.0
for _, tt := range fieldTokens {
tLen := len([]rune(tt))
if qLen <= 3 {
if qt == tt {
return 1.0
}
continue
}
if qLen == 4 {
if qt == tt {
return 1.0
}
if absInt(qLen-tLen) <= 1 && damerauLevenshtein(qt, tt) <= 1 {
if 0.85 > best {
best = 0.85
}
}
continue
}
maxLen := qLen
if tLen > maxLen {
maxLen = tLen
}
dist := damerauLevenshtein(qt, tt)
levSim := 1.0 - float64(dist)/float64(maxLen)
if qLen >= 5 && dist <= 2 && levSim < 0.70 {
levSim = 0.70
}
triSim := trigramSimilarity(qt, tt)
phonSim := 0.0
if len(qSkel) >= 3 && damerauLevenshtein(qSkel, phoneticSkeleton(tt)) <= 1 && absInt(qLen-tLen) <= 2 {
phonSim = 0.86
}
sim := math.Max(levSim, math.Max(triSim, phonSim))
if sim > best {
best = sim
}
}
return best
}

func computeFuzzyScore(queryVariant string, title string) float64 {
qNorm := ruToEnTranslit.Replace(strings.ToLower(queryVariant))
qTokens := tokenize(qNorm)
if len(qTokens) == 0 {
return 0
}

headRaw, bodyRaw := title, ""
for _, sep := range []string{" - ", " – ", " — "} {
if idx := strings.Index(title, sep); idx > 0 {
headRaw = title[:idx]
bodyRaw = title[idx+len(sep):]
break
}
}

headTokens := tokenize(ruToEnTranslit.Replace(strings.ToLower(headRaw)))
bodyTokens := tokenize(ruToEnTranslit.Replace(strings.ToLower(bodyRaw)))
allTokens := append(append([]string{}, headTokens...), bodyTokens...)
if len(allTokens) == 0 {
return 0
}

posMult := positionalPriorityMultiplier(queryVariant, title)

if ok, dist := matchWithinTwoLettersNoSymbols(queryVariant, headRaw); ok {
lenNorm := 1.0 / (1.0 + 0.05*float64(absInt(len(headTokens)-len(qTokens))))
return math.Min(1.0, (0.94-float64(dist)*0.04)*lenNorm*posMult+0.12)
}

totalScore, matched, headHits := 0.0, 0, 0
for _, qt := range qTokens {
hSim := bestTokenSimInField(qt, headTokens)
bSim := bestTokenSimInField(qt, bodyTokens)
best := bSim * 0.84
if hSim >= bSim && hSim > 0 {
best = hSim * 1.12
if hSim >= 0.75 {
headHits++
}
}
if best > 1.0 {
best = 1.0
}
if best >= 0.58 {
matched++
}
totalScore += best
}

avg := (totalScore / float64(len(qTokens))) * posMult
if len(qTokens) >= 2 && matched < len(qTokens) {
avg *= 0.35
}
if headHits > 0 && len(headTokens) > 0 {
avg += 0.14 * (float64(headHits) / float64(len(headTokens)))
}
return math.Min(1.0, avg)
}

func fetchGoogleSuggest(ctx context.Context, query string, hl string) []string {
u := fmt.Sprintf("https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=%s&q=%s", hl, url.QueryEscape(query))
req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
if err != nil {
return nil
}
req.Header.Set("User-Agent", "Mozilla/5.0")
resp, err := httpClient.Do(req)
if err != nil {
return nil
}
defer resp.Body.Close()

var raw []interface{}
if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil || len(raw) < 2 {
return nil
}
suggestions, ok := raw[1].([]interface{})
if !ok {
return nil
}
var out []string
for i, item := range suggestions {
if i >= 5 {
break
}
if s, ok := item.(string); ok {
cleaned := strings.TrimSpace(suggestJunkRe.ReplaceAllString(s, ""))
cleaned = strings.Join(strings.Fields(cleaned), " ")
if len([]rune(cleaned)) >= 2 {
out = append(out, cleaned)
}
}
}
return out
}

func fetchMusicBrainzAliases(ctx context.Context, query string) []string {
u := fmt.Sprintf("https://musicbrainz.org/ws/2/artist/?query=%s&fmt=json&limit=5", url.QueryEscape(query))
req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
if err != nil {
return nil
}
req.Header.Set("User-Agent", "JennyPlayerOmniCore/3.0")
resp, err := httpClient.Do(req)
if err != nil {
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
if a.Score < 85 {
continue
}
if ok, _ := matchWithinTwoLettersNoSymbols(query, a.Name); ok {
out = append(out, a.Name)
for _, al := range a.Aliases {
if al.Name != "" && len(out) < 5 {
out = append(out, al.Name)
}
}
}
}
return out
}

type catalogEntity struct {
text     string
score    float64
isArtist bool
}

func hasCollabMarker(s string) bool {
return featGuestRe.MatchString(s)
}

// Целевой поиск Артистов + Метод поиска по НАЗВАНИЯМ ПЕСЕН исполнителей (для блоков "Возможно, вы имели в виду...")
func fetchCatalogEntities(ctx context.Context, query string) ([]catalogEntity, []ResolvedTrackInfo) {
var out []catalogEntity
var tracks []ResolvedTrackInfo
var mu sync.Mutex
var wg sync.WaitGroup

addEnt := func(txt string, sc float64, isArt bool) {
txt = strings.Join(strings.Fields(strings.TrimSpace(txt)), " ")
if len([]rune(txt)) < 1 {
return
}
mu.Lock()
out = append(out, catalogEntity{text: txt, score: sc, isArtist: isArt})
mu.Unlock()
}

addTrack := func(art, trk string) {
art, trk = strings.TrimSpace(art), strings.TrimSpace(trk)
if art == "" {
return
}
mu.Lock()
tracks = append(tracks, ResolvedTrackInfo{Artist: art, Track: trk})
mu.Unlock()
}

country := "US"
if hasCyrillic(query) {
country = "RU"
}

splitMainAndCollab := func(s string) (string, string) {
if loc := featGuestRe.FindStringIndex(s); loc != nil {
return strings.TrimSpace(s[:loc[0]]), strings.TrimSpace(s[loc[0]:])
}
if idx := strings.Index(s, "("); idx > 0 {
return strings.TrimSpace(s[:idx]), strings.TrimSpace(s[idx:])
}
return strings.TrimSpace(s), ""
}

qComp := normalizeCompact(query)
qRawLen := len([]rune(compactRawLetters(query)))

processCatalogItem := func(idx int, art, trk, alb string) {
mainArt, collabArt := splitMainAndCollab(art)
mainTrk, collabTrk := splitMainAndCollab(trk)
cleanAlb, _ := splitMainAndCollab(alb)
if mainArt == "" {
return
}
decay := float64(idx) * 0.015

// 1. Совпадение с ИМЕНЕМ АРТИСТА (Главный приоритет #1: score ~2.0)
if okArt, distArt := matchWithinTwoLettersNoSymbols(query, mainArt); okArt {
score := 2.02 - float64(distArt)*0.06 - decay
addEnt(mainArt, score, true)
return
}

// 2. НАШ МЕТОД ПОИСКА В НАЗВАНИИ ПЕСЕН ИСПОЛНИТЕЛЕЙ (для блоков "Возможно, вы имели в виду..."):
//    Если название песни совпадает с запросом (+-2 буквы или по фонетическому скелету),
//    вытаскиваем исполнителя этой песни в дополнительные группы (score 1.56..1.45) и запоминаем альбом/трек!
if qRawLen >= 4 {
if okTrk, distTrk := matchStringsIR(query, mainTrk); okTrk {
score := 1.58 - float64(distTrk)*0.04 - decay
target := mainTrk
if cleanAlb != "" && !strings.Contains(strings.ToLower(cleanAlb), "single") {
target = cleanAlb
}
addTrack(mainArt, target)
addTrack(mainArt, mainTrk)
addEnt(mainArt, score, false)
return
}
}

// 3. Участие через feat. / при уч. / &
collabTail := strings.TrimSpace(collabArt + " " + collabTrk)
if collabTail != "" {
if okCol, _ := matchWithinTwoLettersNoSymbols(query, collabTail); okCol && normalizeCompact(mainArt) != qComp {
addEnt(mainArt, 1.44-decay, false)
}
}
}

// Запускаем 3 параллельных потока: iTunes (общий + песни), Deezer (общий) и Deezer Track Search (строго по названиям песен!)
wg.Add(3)
go func() {
defer func() { _ = recover(); wg.Done() }()
u := fmt.Sprintf("https://itunes.apple.com/search?term=%s&country=%s&media=music&entity=song&limit=20", url.QueryEscape(query), country)
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
var data struct {
Results []struct {
ArtistName     string `json:"artistName"`
TrackName      string `json:"trackName"`
CollectionName string `json:"collectionName"`
} `json:"results"`
}
if json.NewDecoder(resp.Body).Decode(&data) == nil {
for idx, it := range data.Results {
processCatalogItem(idx, it.ArtistName, it.TrackName, it.CollectionName)
}
}
}()

go func() {
defer func() { _ = recover(); wg.Done() }()
u := fmt.Sprintf("https://api.deezer.com/search?q=%s&limit=18", url.QueryEscape(query))
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
var data struct {
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
if json.NewDecoder(resp.Body).Decode(&data) == nil {
for idx, it := range data.Data {
tName := it.TitleShort
if tName == "" {
tName = it.Title
}
processCatalogItem(idx, it.Artist.Name, tName, it.Album.Title)
}
}
}()

go func() {
defer func() { _ = recover(); wg.Done() }()
u := fmt.Sprintf("https://api.deezer.com/search/track?q=%s&limit=18", url.QueryEscape(query))
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
var data struct {
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
if json.NewDecoder(resp.Body).Decode(&data) == nil {
for idx, it := range data.Data {
tName := it.TitleShort
if tName == "" {
tName = it.Title
}
processCatalogItem(idx, it.Artist.Name, tName, it.Album.Title)
}
}
}()

wg.Wait()
return out, tracks
}

func buildExpandedQueries(ctx context.Context, rawQuery string, cfg EngineConfig) (string, []string, []ResolvedTrackInfo) {
rawQuery = strings.Join(strings.Fields(strings.TrimSpace(rawQuery)), " ")
if rawQuery == "" {
return "", nil, nil
}
if cfg.ExactMatch {
return rawQuery, []string{rawQuery}, nil
}

type candInfo struct {
text     string
score    float64
isArtist bool
}
scoredMap := make(map[string]candInfo)
var resolvedTracks []ResolvedTrackInfo
var topSuggest string
var mu sync.Mutex

addCandidate := func(term string, score float64, isArt bool) {
term = strings.Join(strings.Fields(strings.TrimSpace(term)), " ")
if len([]rune(term)) < 1 {
return
}
key := normalizeCompact(term)
if key == "" {
key = strings.ToLower(term)
}
mu.Lock()
defer mu.Unlock()
if ex, ok := scoredMap[key]; !ok || score > ex.score {
scoredMap[key] = candInfo{text: term, score: score, isArtist: isArt || ex.isArtist}
}
}

low := strings.ToLower(rawQuery)
probeQuery := rawQuery
if !hasVowels(low) && hasVowels(enToRuLayout.Replace(low)) {
probeQuery = enToRuLayout.Replace(low)
} else if !hasVowels(low) && hasVowels(ruToEnLayout.Replace(low)) {
probeQuery = ruToEnLayout.Replace(low)
}

if trimmed := stripLeadingConsonantCluster(probeQuery); trimmed != "" {
probeQuery = trimmed
}

// Прямой запрос сохраняется со средним весом 1.50:
// - Если найден Артист (2.0), Артист встает на #1, а авторы одноименных песен (1.58) идут сразу за ним в "Возможно, вы имели в виду..."!
// - Если это Песня ("улетаю") или Жанр ("рэп"), и прямые раздачи, и найденные авторы песни (1.58) выводятся вместе!
addCandidate(probeQuery, 1.50, false)

var angloProbes []string
if cfg.EnablePhonetic {
if hasCyrillic(probeQuery) {
for idx, sp := range decodeSpelledLetters(probeQuery) {
addCandidate(sp, 2.08-float64(idx)*0.03, true)
}
angloProbes = ruAngloPhoneticVariants(probeQuery)
for idx, ap := range angloProbes {
addCandidate(ap, 1.40-float64(idx)*0.03, false)
}
}
}

catalogProbe := probeQuery
if spelled := decodeSpelledLetters(probeQuery); len(spelled) > 0 {
catalogProbe = spelled[0]
}

var wg sync.WaitGroup
if cfg.EnableCatalog {
wg.Add(1)
go func() {
defer func() { _ = recover(); wg.Done() }()
ents, trks := fetchCatalogEntities(ctx, catalogProbe)
mu.Lock()
resolvedTracks = append(resolvedTracks, trks...)
mu.Unlock()
for _, ent := range ents {
addCandidate(ent.text, ent.score, ent.isArtist)
}
// Проверяем также фонетические латинские варианты (включая sht -> st для Rammstein - Morgenstern)
for i := 0; i < len(angloProbes) && i < 2; i++ {
if !strings.EqualFold(angloProbes[i], catalogProbe) {
entsA, trksA := fetchCatalogEntities(ctx, angloProbes[i])
mu.Lock()
resolvedTracks = append(resolvedTracks, trksA...)
mu.Unlock()
for _, ent := range entsA {
addCandidate(ent.text, ent.score, ent.isArtist)
}
}
}
}()
}

if cfg.EnablePhonetic {
wg.Add(2)
go func() {
defer func() { _ = recover(); wg.Done() }()
sugs := fetchGoogleSuggest(ctx, probeQuery, "ru")
if len(sugs) > 0 {
mu.Lock()
topSuggest = sugs[0]
mu.Unlock()
}
for idx, s := range sugs {
if ok, dist := matchWithinTwoLettersNoSymbols(probeQuery, s); ok {
addCandidate(s, 1.72-float64(dist)*0.05-float64(idx)*0.02, false)
} else if len(phoneticSkeleton(probeQuery)) >= 4 && damerauLevenshtein(phoneticSkeleton(probeQuery), phoneticSkeleton(s)) <= 1 {
// Фонетическое совпадение скелета (например "драм н бэйс" drmnps <-> "drum and bass" drmntps)
addCandidate(s, 1.82-float64(idx)*0.03, false)
}
}
}()
go func() {
defer func() { _ = recover(); wg.Done() }()
for idx, al := range fetchMusicBrainzAliases(ctx, catalogProbe) {
addCandidate(al, 1.92-float64(idx)*0.03, true)
}
}()
}
wg.Wait()

if cfg.EnableCatalog && topSuggest != "" && !strings.EqualFold(topSuggest, probeQuery) {
if okSug, _ := matchWithinTwoLettersNoSymbols(probeQuery, topSuggest); okSug || damerauLevenshtein(phoneticSkeleton(probeQuery), phoneticSkeleton(topSuggest)) <= 1 {
fixCtx, fixCancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
ents2, trks2 := fetchCatalogEntities(fixCtx, topSuggest)
fixCancel()
resolvedTracks = append(resolvedTracks, trks2...)
addCandidate(topSuggest, 1.76, false)
for _, ent := range ents2 {
addCandidate(ent.text, ent.score, ent.isArtist)
}
}
}

// Если найден подтвержденный главный Артист (>= 1.90), отсекаем сырые транслиты (< 1.42),
// НО ОСТАВЛЯЕМ всех исполнителей одноименных песен (1.44..1.58) для списков "Возможно, вы имели в виду..."!
hasMainArtist := false
for _, v := range scoredMap {
if v.isArtist && v.score >= 1.90 {
hasMainArtist = true
break
}
}
if hasMainArtist {
for k, v := range scoredMap {
if v.score < 1.43 {
delete(scoredMap, k)
}
}
}

var list []candInfo
for _, v := range scoredMap {
list = append(list, v)
}
sort.Slice(list, func(i, j int) bool {
return list[i].score > list[j].score
})

var finalTerms []string
for _, item := range list {
finalTerms = append(finalTerms, item.text)
if len(finalTerms) >= 5 {
break
}
}
if len(finalTerms) == 0 {
finalTerms = []string{rawQuery}
}
return finalTerms[0], finalTerms, resolvedTracks
}

var (
  rutorRowRe    = regexp.MustCompile(`(?s)<tr class="(?:gai|tum)">(.*?)</tr>`)
  rutorMagnetRe = regexp.MustCompile(`(?i)href="(magnet:\?xt=urn:btih:([a-f0-9]{40})[^"]*)"`)
  rutorTitleRe  = regexp.MustCompile(`(?s)<a[^>]+href="/torrent/[^"]+"[^>]*>(.*?)</a>`)
  rutorSizeRe   = regexp.MustCompile(`(?i)([0-9]+(?:[.,][0-9]+)?)\s*(GB|MB|KB|TB|ГБ|МБ|КБ|ТБ)`)
  rutorSeedsRe  = regexp.MustCompile(`(?s)class="green"[^>]*>.*?([0-9]+)`)
  rutorPeersRe  = regexp.MustCompile(`(?s)class="red"[^>]*>.*?([0-9]+)`)

  bitMagnetRe = regexp.MustCompile(`(?i)href=["'](magnet:\?xt=urn:btih:([a-f0-9]{40})[^"']*)["']`)
  bitTitleRe  = regexp.MustCompile(`(?s)class="title[^"]*"[^>]*>\s*<a[^>]*>(.*?)</a>`)
  bitSizeRe   = regexp.MustCompile(`(?i)([0-9]+(?:[.,][0-9]+)?)\s*(GB|MB|KB)`)
  bitSeedsRe  = regexp.MustCompile(`(?i)(?:color:\s*#039e03|text-green)[^>]*>\s*([0-9,]+)`)

  dohHTTPClient = &http.Client{
    Timeout: 8500 * time.Millisecond,
    Transport: &http.Transport{
      TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
      DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
        host, port, err := net.SplitHostPort(addr)
        if err != nil {
          return nil, err
        }
        if strings.Contains(host, "rutor.") {
          resolvedIP := resolveRutorIP(ctx)
          if resolvedIP != "" {
            addr = net.JoinHostPort(resolvedIP, port)
          }
        }
        dialer := &net.Dialer{Timeout: 5 * time.Second}
        return dialer.DialContext(ctx, network, addr)
      },
    },
  }
)

func resolveRutorIP(ctx context.Context) string {
  rutorCacheMu.RLock()
  if rutorCachedIP != "" && time.Since(rutorCacheTS) < time.Hour {
    ip := rutorCachedIP
    rutorCacheMu.RUnlock()
    return ip
  }
  rutorCacheMu.RUnlock()

  dohCtx, cancel := context.WithTimeout(ctx, 900*time.Millisecond)
  defer cancel()
  req, err := http.NewRequestWithContext(dohCtx, "GET", "https://dns.google/resolve?name=rutor.info&type=A", nil)
  if err == nil {
    req.Header.Set("User-Agent", "Mozilla/5.0")
    if resp, err := httpClient.Do(req); err == nil {
      defer resp.Body.Close()
      var doh struct {
        Answer []struct {
          Type int    `json:"type"`
          Data string `json:"data"`
        } `json:"Answer"`
      }
      if json.NewDecoder(resp.Body).Decode(&doh) == nil {
        for _, ans := range doh.Answer {
          if ans.Type == 1 && net.ParseIP(ans.Data) != nil {
            rutorCacheMu.Lock()
            rutorCachedIP = ans.Data
            rutorCacheTS = time.Now()
            rutorCacheMu.Unlock()
            return ans.Data
          }
        }
      }
    }
  }

  rutorCacheMu.Lock()
  if rutorCachedIP == "" {
    rutorCachedIP = "193.46.255.29"
  }
  rutorCacheTS = time.Now()
  ip := rutorCachedIP
  rutorCacheMu.Unlock()
  return ip
}

func searchRutorDoH(ctx context.Context, query string) []TorrentResult {
  cleanR := strings.NewReplacer("/", " ", "'", " ").Replace(query)
  u := "http://rutor.info/search/0/0/000/2/" + url.PathEscape(cleanR)
  req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
  if err != nil {
    return nil
  }
  req.Host = "rutor.info"
  req.Header.Set("Host", "rutor.info")
  req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")

  resp, err := dohHTTPClient.Do(req)
  if err != nil {
    return nil
  }
  defer resp.Body.Close()

  bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 650*1024))
  if err != nil {
    return nil
  }
  html := string(bodyBytes)

  rows := rutorRowRe.FindAllStringSubmatch(html, 50)
  var results []TorrentResult

  for _, rowMatch := range rows {
    // Заменяем &nbsp; и UTF-8 неразрывные пробелы на обычный пробел, чтобы размер никогда не был 0 MB!
    row := strings.ReplaceAll(rowMatch[1], "&nbsp;", " ")
    row = strings.ReplaceAll(row, "&#160;", " ")
    row = strings.ReplaceAll(row, "\u00a0", " ")

    magMatch := rutorMagnetRe.FindStringSubmatch(row)
    if len(magMatch) < 3 {
      continue
    }
    hash := strings.ToLower(magMatch[2])

    tMatches := rutorTitleRe.FindAllStringSubmatch(row, -1)
    if len(tMatches) == 0 {
      continue
    }
    title := cleanTitle(tMatches[len(tMatches)-1][1])
    if title == "" {
      continue
    }
    // Строгий фильтр для аудиоплеера: отсекаем любые фильмы, книги, игры и клипы,
    // и требуем наличия музыкального маркера в названии раздачи с Rutor!
    if bookJunkRe.MatchString(title) {
      continue
    }

    var sizeBytes int64
    var sizeMB float64
    if szMatches := rutorSizeRe.FindAllStringSubmatch(row, -1); len(szMatches) > 0 {
      szMatch := szMatches[len(szMatches)-1]
      numClean := strings.ReplaceAll(szMatch[1], ",", ".")
      val, _ := strconv.ParseFloat(numClean, 64)
      unit := strings.ToUpper(szMatch[2])
      if unit == "GB" || unit == "ГБ" {
        sizeMB = math.Round(val*1024*10) / 10
      } else if unit == "TB" || unit == "ТБ" {
        sizeMB = math.Round(val*1024*1024*10) / 10
      } else if unit == "KB" || unit == "КБ" {
        sizeMB = math.Round((val/1024)*10) / 10
      } else {
        sizeMB = math.Round(val*10) / 10
      }
      sizeBytes = int64(sizeMB * 1024 * 1024)
    }

    seeds := 1
    if sMatch := rutorSeedsRe.FindStringSubmatch(row); len(sMatch) >= 2 {
      seeds, _ = strconv.Atoi(sMatch[1])
    }
    peers := 0
    if pMatch := rutorPeersRe.FindStringSubmatch(row); len(pMatch) >= 2 {
      peers, _ = strconv.Atoi(pMatch[1])
    }

    results = append(results, TorrentResult{
      Title:     title,
      Magnet:    buildMagnet(hash, title),
      InfoHash:  hash,
      Size:      sizeBytes,
      SizeMB:    sizeMB,
      SizeHuman: formatBytes(sizeBytes),
      Seeds:     seeds,
      Peers:     peers,
      Source:    "Rutor",
    })
  }
  return results
}

var (
  bitCardSplitRe = regexp.MustCompile(`(?is)<li\s+class="[^"]*search-result[^"]*">`)
  bitTitleV2Re   = regexp.MustCompile(`(?is)<h5\s+class="title[^"]*">.*?<a[^>]*>(.*?)</a>`)
  bitSizeV2Re    = regexp.MustCompile(`(?is)alt="Size"[^>]*>\s*([0-9.,]+)\s*(B|KB|MB|GB|TB)`)
  bitSeedersV2Re = regexp.MustCompile(`(?is)alt="Seeder"[^>]*>.*?(\d[\d,]*)`)
  bitLeechV2Re   = regexp.MustCompile(`(?is)alt="Leecher"[^>]*>.*?(\d[\d,]*)`)
)

func searchBitsearch(ctx context.Context, query string) []TorrentResult {
  cleanQ := strings.ReplaceAll(query, "-", " ")
  u := "https://bitsearch.to/search?q=" + url.QueryEscape(cleanQ) + "&sort=seeders"
  req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
  if err != nil {
    return nil
  }
  req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")

  resp, err := httpClient.Do(req)
  if err != nil {
    return nil
  }
  defer resp.Body.Close()

  bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 650*1024))
  if err != nil {
    return nil
  }
  html := string(bodyBytes)

  seen := make(map[string]bool)
  var results []TorrentResult

  cards := bitCardSplitRe.Split(html, -1)
  for i := 1; i < len(cards) && len(results) < 40; i++ {
    card := strings.ReplaceAll(cards[i], "&nbsp;", " ")
    magMatch := bitMagnetRe.FindStringSubmatch(card)
    if len(magMatch) < 3 {
      continue
    }
    magRaw := strings.ReplaceAll(magMatch[1], "&amp;", "&")
    hash := strings.ToLower(magMatch[2])
    if seen[hash] {
      continue
    }
    seen[hash] = true

    title := ""
    if tm := bitTitleV2Re.FindStringSubmatch(card); len(tm) > 1 {
      title = cleanTitle(tm[1])
    }
    if len([]rune(title)) < 3 {
      title = cleanTitle(extractNameFromMagnet(magRaw))
    }
    if title == "" || bookJunkRe.MatchString(title) {
      continue
    }

    var sizeBytes int64
    var sizeMB float64
    szMatch := bitSizeV2Re.FindStringSubmatch(card)
    if len(szMatch) < 3 {
      szMatch = bitSizeRe.FindStringSubmatch(card)
    }
    if len(szMatch) >= 3 {
      val, _ := strconv.ParseFloat(strings.ReplaceAll(szMatch[1], ",", "."), 64)
      unit := strings.ToUpper(szMatch[2])
      if unit == "GB" {
        sizeMB = math.Round(val*1024*10) / 10
      } else if unit == "TB" {
        sizeMB = math.Round(val*1024*1024*10) / 10
      } else if unit == "KB" {
        sizeMB = math.Round((val/1024)*10) / 10
      } else {
        sizeMB = math.Round(val*10) / 10
      }
      sizeBytes = int64(sizeMB * 1024 * 1024)
    }

    seeds := 0
    if sm := bitSeedersV2Re.FindStringSubmatch(card); len(sm) > 1 {
      seeds, _ = strconv.Atoi(strings.ReplaceAll(sm[1], ",", ""))
    } else if sm2 := bitSeedsRe.FindStringSubmatch(card); len(sm2) > 1 {
      seeds, _ = strconv.Atoi(strings.ReplaceAll(sm2[1], ",", ""))
    }

    peers := 0
    if lm := bitLeechV2Re.FindStringSubmatch(card); len(lm) > 1 {
      peers, _ = strconv.Atoi(strings.ReplaceAll(lm[1], ",", ""))
    }

    results = append(results, TorrentResult{
      Title:     title,
      Magnet:    buildMagnet(hash, title),
      InfoHash:  hash,
      Size:      sizeBytes,
      SizeMB:    sizeMB,
      SizeHuman: formatBytes(sizeBytes),
      Seeds:     seeds,
      Peers:     peers,
      Source:    "BitSearch",
    })
  }
  return results
}

func searchApiBay(ctx context.Context, query string) []TorrentResult {
  cleanQ := strings.ReplaceAll(query, "-", " ")
  u := "https://apibay.org/q.php?q=" + url.QueryEscape(cleanQ)
  req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
  if err != nil {
    return nil
  }
  req.Header.Set("User-Agent", "Mozilla/5.0")

  resp, err := httpClient.Do(req)
  if err != nil {
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
  if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
    return nil
  }

  var results []TorrentResult
  for _, it := range items {
    if it.Name == "No results returned" || it.InfoHash == "0000000000000000000000000000000000000000" {
      continue
    }
    title := cleanTitle(it.Name)
    if title == "" || bookJunkRe.MatchString(title) {
      continue
    }
    seeds, _ := strconv.Atoi(it.Seeders)
    peers, _ := strconv.Atoi(it.Leechers)
    sizeBytes, _ := strconv.ParseInt(it.Size, 10, 64)
    sizeMB := math.Round((float64(sizeBytes)/(1024*1024))*10) / 10
    hash := strings.ToLower(strings.TrimSpace(it.InfoHash))
    if len(hash) != 40 {
      continue
    }
    results = append(results, TorrentResult{
      Title:     title,
      Magnet:    buildMagnet(hash, title),
      InfoHash:  hash,
      Size:      sizeBytes,
      SizeMB:    sizeMB,
      SizeHuman: formatBytes(sizeBytes),
      Seeds:     seeds,
      Peers:     peers,
      Source:    "ApiBay",
      Category:  it.Category,
    })
  }
  return results
}

func searchKnaben(ctx context.Context, query string) []TorrentResult {
  kCtx, cancel := context.WithTimeout(ctx, 2600*time.Millisecond)
  defer cancel()

  cleanQ := strings.ReplaceAll(query, "-", " ")
  payload := map[string]interface{}{
    "query":           cleanQ,
    "size":            40,
    "order_by":        "seeders",
    "order_direction": "desc",
  }
  bodyBytes, _ := json.Marshal(payload)
  req, err := http.NewRequestWithContext(kCtx, "POST", "https://api.knaben.eu/v1", bytes.NewReader(bodyBytes))
  if err != nil {
    return nil
  }
  req.Header.Set("Content-Type", "application/json")
  req.Header.Set("User-Agent", "Mozilla/5.0")

  resp, err := httpClient.Do(req)
  if err != nil || resp.StatusCode != 200 {
    if resp != nil {
      resp.Body.Close()
    }
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
  if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
    return nil
  }

  var results []TorrentResult
  for _, h := range data.Hits {
    title := cleanTitle(h.Title)
    if title == "" || bookJunkRe.MatchString(title) {
      continue
    }
    hash := strings.ToLower(strings.TrimSpace(h.Hash))
    if hash == "" {
      hash = extractInfoHash(h.MagnetUrl)
    }
    if len(hash) != 40 {
      continue
    }
    sizeMB := math.Round((float64(h.Bytes)/(1024*1024))*10) / 10
    results = append(results, TorrentResult{
      Title:     title,
      Magnet:    buildMagnet(hash, title),
      InfoHash:  hash,
      Size:      h.Bytes,
      SizeMB:    sizeMB,
      SizeHuman: formatBytes(h.Bytes),
      Seeds:     h.Seeders,
      Peers:     h.Peers,
      Source:    "Knaben",
      Category:  h.Category,
    })
  }
  return results
}

var udpTrackers = []string{
  "tracker.opentrackr.org:1337",
  "open.stealth.si:80",
  "exodus.desync.com:6969",
  "tracker.torrent.eu.org:451",
}

func udpScrapeSingleTracker(trackerAddr string, validHashes []string, rawBinHashes [][]byte) map[string][2]int {
  out := make(map[string][2]int)
  conn, err := net.DialTimeout("udp", trackerAddr, 900*time.Millisecond)
  if err != nil {
    return out
  }
  defer conn.Close()
  _ = conn.SetDeadline(time.Now().Add(900 * time.Millisecond))

  tid1 := uint32(rand.Int31())
  var reqConnect [16]byte
  binary.BigEndian.PutUint64(reqConnect[0:8], 0x41727101980)
  binary.BigEndian.PutUint32(reqConnect[8:12], 0)
  binary.BigEndian.PutUint32(reqConnect[12:16], tid1)

  if _, err := conn.Write(reqConnect[:]); err != nil {
    return out
  }

  var respConnect [16]byte
  n, err := conn.Read(respConnect[:])
  if err != nil || n < 16 {
    return out
  }
  rAct := binary.BigEndian.Uint32(respConnect[0:4])
  rTid := binary.BigEndian.Uint32(respConnect[4:8])
  connID := binary.BigEndian.Uint64(respConnect[8:16])
  if rAct != 0 || rTid != tid1 {
    return out
  }

  tid2 := uint32(rand.Int31())
  pkt := make([]byte, 16+20*len(rawBinHashes))
  binary.BigEndian.PutUint64(pkt[0:8], connID)
  binary.BigEndian.PutUint32(pkt[8:12], 2)
  binary.BigEndian.PutUint32(pkt[12:16], tid2)
  for i, bh := range rawBinHashes {
    copy(pkt[16+i*20:16+(i+1)*20], bh)
  }

  if _, err := conn.Write(pkt); err != nil {
    return out
  }

  respBuf := make([]byte, 8+12*len(rawBinHashes))
  n2, err := conn.Read(respBuf)
  if err != nil || n2 < 8 {
    return out
  }
  if binary.BigEndian.Uint32(respBuf[0:4]) != 2 || binary.BigEndian.Uint32(respBuf[4:8]) != tid2 {
    return out
  }

  body := respBuf[8:n2]
  for i, hHex := range validHashes {
    off := i * 12
    if off+12 <= len(body) {
      s := int(binary.BigEndian.Uint32(body[off : off+4]))
      l := int(binary.BigEndian.Uint32(body[off+8 : off+12]))
      out[hHex] = [2]int{s, l}
    }
  }
  return out
}

// Пакетный BEP-15 UDP Scrape до 74 хешей в чанке сразу по 4 UDP-трекерам
func udpScrapeBatch(hashes []string) map[string][2]int {
  var validHashes []string
  var rawBinHashes [][]byte
  seen := make(map[string]bool)
  for _, h := range hashes {
    if len(h) == 40 && !seen[h] {
      if b, err := hex.DecodeString(h); err == nil && len(b) == 20 {
        seen[h] = true
        validHashes = append(validHashes, h)
        rawBinHashes = append(rawBinHashes, b)
      }
    }
  }
  merged := make(map[string][2]int)
  if len(validHashes) == 0 {
    return merged
  }

  var mu sync.Mutex
  var wg sync.WaitGroup
  for start := 0; start < len(validHashes); start += 72 {
    end := start + 72
    if end > len(validHashes) {
      end = len(validHashes)
    }
    chHex := validHashes[start:end]
    chBin := rawBinHashes[start:end]

    for _, tr := range udpTrackers {
      wg.Add(1)
      go func(addr string, hSlice []string, bSlice [][]byte) {
        defer func() { _ = recover(); wg.Done() }()
        res := udpScrapeSingleTracker(addr, hSlice, bSlice)
        mu.Lock()
        for h, sl := range res {
          prev := merged[h]
          if sl[0] > prev[0] {
            prev[0] = sl[0]
          }
          if sl[1] > prev[1] {
            prev[1] = sl[1]
          }
          merged[h] = prev
        }
        mu.Unlock()
      }(tr, chHex, chBin)
    }
  }
  wg.Wait()
  return merged
}

var fmtKeywordsMap = map[string][]string{
  "flac": {"flac", "lossless", "24bit", "hi-res", "alac"},
  "wav":  {"wav", "wave", "pcm", "lossless"},
  "mp3":  {"mp3", "320", "cbr", "vbr", "mpeg"},
  "m4a":  {"m4a", "alac", "itunes", "aac"},
  "aac":  {"aac", "m4a", "mp4"},
  "ogg":  {"ogg", "vorbis", "opus"},
}

func isDiscographyOrCollection(titleLow string) bool {
  keywords := []string{
    "discography", "дискография", "collection", "коллекция", "anthology", "антология",
    "complete", "полное собрание", "альбомы", "albums", "flac", "lossless", "mp3", "320",
  }
  for _, kw := range keywords {
    if strings.Contains(titleLow, kw) {
      return true
    }
  }
  return false
}

func matchesFormatFilter(title string, fmtTag string, exact bool) bool {
  fmtTag = strings.ToLower(strings.TrimSpace(fmtTag))
  tokens, ok := fmtKeywordsMap[fmtTag]
  if !ok || fmtTag == "" || fmtTag == "all" {
    return true
  }
  low := strings.ToLower(title)
  hasTarget := false
  for _, tok := range tokens {
    if strings.Contains(low, tok) {
      hasTarget = true
      break
    }
  }
  if exact {
    return hasTarget
  }
  if hasTarget {
    return true
  }
  otherFormats := []string{"flac", "mp3", "wav", "m4a", "aac", "ogg"}
  for _, of := range otherFormats {
    if of != fmtTag && strings.Contains(low, of) {
      return false
    }
  }
  return true
}

func searchSingleVariantAcrossIndexers(ctx context.Context, variantQuery string, fmtTag string, exact bool) []TorrentResult {
  hasCyr := hasCyrillic(variantQuery)
  latQuery := variantQuery
  if hasCyr {
    latQuery = ruToEnTranslit.Replace(strings.ToLower(variantQuery))
  }
  noHyphen := strings.ReplaceAll(variantQuery, "-", " ")
  fmtSuffix := ""
  if _, ok := fmtKeywordsMap[fmtTag]; ok {
    fmtSuffix = " " + strings.ToUpper(fmtTag)
  }

  type searchJob struct {
    fn  func(context.Context, string) []TorrentResult
    arg string
  }

  var jobs []searchJob
  if fmtSuffix != "" {
    jobs = append(jobs, searchJob{searchRutorDoH, noHyphen + fmtSuffix})
    if noHyphen != variantQuery {
      jobs = append(jobs, searchJob{searchRutorDoH, variantQuery + fmtSuffix})
    }
  } else {
    jobs = append(jobs, searchJob{searchRutorDoH, noHyphen + " MP3"})
    jobs = append(jobs, searchJob{searchRutorDoH, noHyphen + " FLAC"})
    if noHyphen != variantQuery {
      jobs = append(jobs, searchJob{searchRutorDoH, variantQuery + " MP3"})
      jobs = append(jobs, searchJob{searchRutorDoH, variantQuery + " FLAC"})
    }
  }
  jobs = append(jobs, searchJob{searchRutorDoH, noHyphen})
  if !hasCyr && !exact {
    ruQ := enToRuTranslit.Replace(strings.ToLower(noHyphen))
    jobs = append(jobs, searchJob{searchRutorDoH, ruQ + " MP3"})
    jobs = append(jobs, searchJob{searchRutorDoH, ruQ + " FLAC"})
    jobs = append(jobs, searchJob{searchRutorDoH, ruQ})
  }
  if noHyphen != variantQuery {
    jobs = append(jobs, searchJob{searchRutorDoH, variantQuery})
  }
  jobs = append(jobs, searchJob{searchApiBay, latQuery + fmtSuffix})
  jobs = append(jobs, searchJob{searchKnaben, latQuery + fmtSuffix})
  if !strings.EqualFold(latQuery, variantQuery) {
    jobs = append(jobs, searchJob{searchApiBay, variantQuery})
    jobs = append(jobs, searchJob{searchKnaben, variantQuery})
  }
  if !exact {
    jobs = append(jobs, searchJob{searchBitsearch, latQuery + fmtSuffix})
    if hasCyr {
      jobs = append(jobs, searchJob{searchBitsearch, variantQuery})
    }
  }

  var mu sync.Mutex
  dedup := make(map[string]TorrentResult)
  var wg sync.WaitGroup

  for _, jb := range jobs {
    wg.Add(1)
    go func(j searchJob) {
      defer func() { _ = recover(); wg.Done() }()
      items := j.fn(ctx, j.arg)
      mu.Lock()
      for _, it := range items {
        key := it.InfoHash
        if key == "" {
          key = strings.ToLower(it.Title)
        }
        if ex, ok := dedup[key]; ok {
          if it.Seeds > ex.Seeds {
            ex.Seeds = it.Seeds
            ex.Peers = it.Peers
          }
          if ex.SizeMB == 0 && it.SizeMB > 0 {
            ex.Size = it.Size
            ex.SizeMB = it.SizeMB
            ex.SizeHuman = it.SizeHuman
          }
          dedup[key] = ex
        } else {
          dedup[key] = it
        }
      }
      mu.Unlock()
    }(jb)
  }
  wg.Wait()

  var list []TorrentResult
  for _, v := range dedup {
    list = append(list, v)
  }
  return list
}

func rankAndFilter(results []TorrentResult, matchTerms []string, resolvedTracks []ResolvedTrackInfo, origQuery string, cfg EngineConfig, maxResults int) ([]TorrentResult, int) {
  var filtered []TorrentResult
  hiddenZero := 0
  minReqSeeds := 0
  if cfg.MinTwoSeeds {
    minReqSeeds = 2
  } else if cfg.HideZeroSeeds {
    minReqSeeds = 1
  }

  origWords := tokenize(strings.ToLower(origQuery))

  for _, item := range results {
    lowTitle := strings.ToLower(item.Title)

    if cfg.ExactMatch {
      allPresent := true
      for _, w := range origWords {
        hasTok := false
        for _, tk := range tokenize(lowTitle) { if tk == w { hasTok = true; break } }
        if !hasTok {
          allPresent = false
          break
        }
      }
      if !allPresent {
        continue
      }
    }

    if !matchesFormatFilter(item.Title, cfg.FormatTag, cfg.ExactMatch) {
      continue
    }
    if cfg.Year != "" {
      if !strings.Contains(lowTitle, strings.ToLower(cfg.Year)) {
        continue
      }
    }

    bestMatch := 0.0
    matchedVia := ""
    for _, term := range matchTerms {
      s := computeFuzzyScore(term, item.Title)
      if s > bestMatch {
        bestMatch = s
      }
    }

    // Буст альбомов и дискографий по найденной песне (из v2.0)
    for _, rt := range resolvedTracks {
      artScore := computeFuzzyScore(rt.Artist, item.Title)
      if artScore >= 0.80 {
        if rt.Album != "" && computeFuzzyScore(rt.Album, item.Title) >= 0.75 {
          if bestMatch < 0.92 {
            bestMatch = 0.92
            matchedVia = fmt.Sprintf("track->album: %s - %s", rt.Artist, rt.Album)
          }
        } else if isDiscographyOrCollection(lowTitle) {
          if bestMatch < 0.86 {
            bestMatch = 0.86
            matchedVia = fmt.Sprintf("track->discography: %s", rt.Artist)
          }
        }
      }
    }

    if !cfg.ExactMatch && bestMatch < cfg.MinFuzzyScore {
      continue
    }

    if item.Seeds < minReqSeeds {
      hiddenZero++
      continue
    }

    item.MatchScore = math.Round(bestMatch*1000) / 1000
    item.MatchedVia = matchedVia

    seedBoost := 0.0
    if item.Seeds > 0 {
      seedBoost = math.Log10(float64(item.Seeds+1)) * 0.16
    } else {
      seedBoost = -0.25
    }

    isVid := videoJunkRegex.MatchString(item.Title)
    hasAud := audioGoodRegex.MatchString(item.Title) || isDiscographyOrCollection(lowTitle)
    if cfg.Profile == "audio" || cfg.Profile == "" {
      if isVid && !hasAud {
        continue
      }
    } else if cfg.Profile == "video" {
      if !isVid {
        continue
      }
    }
    audioBoost := 0.0
    if cfg.Profile == "video" && isVid {
      audioBoost = 0.22
    } else if hasAud {
      audioBoost = 0.18
    }
    if tokens, ok := fmtKeywordsMap[cfg.FormatTag]; ok {
      for _, tok := range tokens {
        if strings.Contains(lowTitle, tok) {
          audioBoost += 0.15
          break
        }
      }
    }

    item.FinalRank = math.Round((bestMatch+seedBoost+audioBoost)*1000) / 1000
    filtered = append(filtered, item)
  }

  sort.Slice(filtered, func(i, j int) bool {
    if (filtered[i].Seeds > 0) != (filtered[j].Seeds > 0) {
      return filtered[i].Seeds > 0
    }
    if math.Abs(filtered[i].FinalRank-filtered[j].FinalRank) > 0.05 {
      return filtered[i].FinalRank > filtered[j].FinalRank
    }
    return filtered[i].Seeds > filtered[j].Seeds
  })

  if maxResults > 0 && len(filtered) > maxResults {
    filtered = filtered[:maxResults]
  }
  return filtered, hiddenZero
}

func executeOmniSearchWithConfig(rawQuery string, cfg EngineConfig, maxResults int) SearchResponse {
  start := time.Now()
  if cfg.TimeoutMs <= 0 {
    cfg.TimeoutMs = 10000
  }
  if cfg.MinFuzzyScore <= 0 {
    cfg.MinFuzzyScore = 0.52
  }

  resolveCtx, resolveCancel := context.WithTimeout(context.Background(), 1800*time.Millisecond)
  corrected, expandedTerms, resolvedTracks := buildExpandedQueries(resolveCtx, rawQuery, cfg)
  resolveCancel()

  ctx, cancel := context.WithTimeout(context.Background(), 4500*time.Millisecond)
  defer cancel()
  if len(expandedTerms) == 0 {
    return SearchResponse{
      Status:        "error",
      OriginalQuery: rawQuery,
    }
  }

  candidateVariants := expandedTerms
  if cfg.ExactMatch {
    candidateVariants = []string{rawQuery}
  } else if len(candidateVariants) > 5 {
    candidateVariants = candidateVariants[:5]
  }

  rawGroups := make([][]TorrentResult, len(candidateVariants))
  var wg sync.WaitGroup

  for idx, vq := range candidateVariants {
    wg.Add(1)
    go func(i int, qStr string) {
      defer func() { _ = recover(); wg.Done() }()
      qWithYear := qStr
      if cfg.Year != "" && !strings.Contains(qStr, cfg.Year) {
        qWithYear = qStr + " " + cfg.Year
      }
      items := searchSingleVariantAcrossIndexers(ctx, qWithYear, cfg.FormatTag, cfg.ExactMatch)
      if qWithYear != qStr {
        items = append(items, searchSingleVariantAcrossIndexers(ctx, qStr, cfg.FormatTag, cfg.ExactMatch)...)
      }
      rawGroups[i] = items
    }(idx, vq)
  }
  wg.Wait()

  // Единый пакетный UDP-Scrape сразу для всех уникальных info_hash из всех групп по 4 трекерам
  var allHashes []string
  seenHash := make(map[string]bool)
  for _, grpItems := range rawGroups {
    for _, it := range grpItems {
      if len(it.InfoHash) == 40 && !seenHash[it.InfoHash] {
        seenHash[it.InfoHash] = true
        allHashes = append(allHashes, it.InfoHash)
      }
    }
  }

  if len(allHashes) > 0 {
    liveMap := udpScrapeBatch(allHashes)
    for gIdx := range rawGroups {
      for i := range rawGroups[gIdx] {
        if sl, ok := liveMap[rawGroups[gIdx][i].InfoHash]; ok {
          if sl[0] > rawGroups[gIdx][i].Seeds {
            rawGroups[gIdx][i].Seeds = sl[0]
          }
          if sl[1] > rawGroups[gIdx][i].Peers {
            rawGroups[gIdx][i].Peers = sl[1]
          }
        }
      }
    }
  }

  var validGroups []VariantGroup
  var flatResults []TorrentResult
  seenFlat := make(map[string]bool)
  totalHiddenZero := 0

  for idx, vq := range candidateVariants {
    ranked, hid := rankAndFilter(rawGroups[idx], []string{vq, corrected}, resolvedTracks, rawQuery, cfg, 45)
    totalHiddenZero += hid
    if len(ranked) == 0 {
      continue
    }

    // Для первой (главной) группы отделяем чистые сольные раздачи в Группу #1,
    // а все совместные релизы (feat., feature, при уч., при участии, &) выносим отдельной группой в допы (#2)!
    if idx == 0 && !cfg.ExactMatch {
      var soloItems []TorrentResult
      var collabItems []TorrentResult
      for _, it := range ranked {
        headPart := it.Title
        for _, sep := range []string{" - ", " – ", " — "} {
          if sIdx := strings.Index(it.Title, sep); sIdx > 0 {
            headPart = it.Title[:sIdx]
            break
          }
        }
        if hasCollabMarker(it.Title) || positionalPriorityMultiplier(vq, it.Title) < 0.90 || (strings.Contains(headPart, "&") && !strings.Contains(vq, "&")) {
          collabItems = append(collabItems, it)
        } else {
          soloItems = append(soloItems, it)
        }
      }
      if len(soloItems) > 0 {
        validGroups = append(validGroups, VariantGroup{
          Query:   vq,
          Count:   len(soloItems),
          Results: soloItems,
        })
        if len(collabItems) > 0 {
          validGroups = append(validGroups, VariantGroup{
            Query:   vq + " (feat. / при уч. / &)",
            Count:   len(collabItems),
            Results: collabItems,
          })
        }
      } else {
        validGroups = append(validGroups, VariantGroup{
          Query:   vq,
          Count:   len(ranked),
          Results: ranked,
        })
      }
    } else {
      if idx > 0 && len(ranked) > 5 { ranked = ranked[:5] }
      validGroups = append(validGroups, VariantGroup{
        Query:   vq,
        Count:   len(ranked),
        Results: ranked,
      })
    }

    for _, it := range ranked {
      if !seenFlat[it.InfoHash] {
        seenFlat[it.InfoHash] = true
        flatResults = append(flatResults, it)
      }
    }
    if len(validGroups) >= 5 {
      break
    }
  }

  if maxResults > 0 && len(flatResults) > maxResults {
    flatResults = flatResults[:maxResults]
  }

  usedCorrected := ""
  if len(validGroups) > 0 && !strings.EqualFold(validGroups[0].Query, rawQuery) {
    usedCorrected = validGroups[0].Query
  }

  return SearchResponse{
    Status:         "ok",
    OriginalQuery:  rawQuery,
    CorrectedQuery: usedCorrected,
    ResolvedTracks: resolvedTracks,
    ExpandedTerms:  expandedTerms,
    ElapsedMs:      time.Since(start).Milliseconds(),
    TotalFound:     len(flatResults),
    HiddenZero:     totalHiddenZero,
    Groups:         validGroups,
    Results:        flatResults,
  }
}

// Безопасный HTTP-сервер для изолированного запуска с CGO_ENABLED=0 (не может уронить плеер)
func StartOmniHTTPServer(listenAddr string) error {
  mux := http.NewServeMux()

  mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _, _ = w.Write([]byte(`{"status":"ok","version":"3.0-ir"}`))
  })
  mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
    _, _ = w.Write([]byte("bye"))
    go func() { time.Sleep(50 * time.Millisecond); os.Exit(0) }()
  })

  mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
    defer func() {
      if rec := recover(); rec != nil {
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
          "status": "error",
          "error":  fmt.Sprintf("recovered panic: %v", rec),
        })
      }
    }()

    var req struct {
      Query          string `json:"query"`
      FormatTag      string `json:"format_tag"`
      Year           string `json:"year"`
      Profile        string `json:"profile"`
      EnablePhonetic *bool  `json:"enable_phonetic"`
      EnableCatalog  *bool  `json:"enable_catalog"`
      EnableUDP      *bool  `json:"enable_udp"`
      Exact          bool   `json:"exact"`
      HideZero       *bool  `json:"hide_zero"`
      MinTwoSeeds    bool   `json:"min_two_seeds"`
      MaxResults     int    `json:"max_results"`
      TimeoutMs      int    `json:"timeout_ms"`
    }

    if r.Method == "POST" {
      bodyBytes, _ := io.ReadAll(io.LimitReader(r.Body, 64*1024))
      _ = json.Unmarshal(bodyBytes, &req)
    } else {
      req.Query = r.URL.Query().Get("q")
      req.FormatTag = r.URL.Query().Get("format_tag")
      req.MaxResults, _ = strconv.Atoi(r.URL.Query().Get("limit"))
    }

    cfgMu.RLock()
    cfg := globalConfig
    cfgMu.RUnlock()

    if req.FormatTag != "" {
      cfg.FormatTag = strings.ToLower(strings.TrimSpace(req.FormatTag))
    }
    cfg.Year = strings.TrimSpace(req.Year)
    if req.Profile != "" {
      cfg.Profile = strings.ToLower(strings.TrimSpace(req.Profile))
    }
    if req.EnablePhonetic != nil {
      cfg.EnablePhonetic = *req.EnablePhonetic
    }
    if req.EnableCatalog != nil {
      cfg.EnableCatalog = *req.EnableCatalog
    }
    if req.EnableUDP != nil {
      cfg.EnableUDP = *req.EnableUDP
    }
    cfg.ExactMatch = req.Exact
    if req.HideZero != nil {
      cfg.HideZeroSeeds = *req.HideZero
    }
    cfg.MinTwoSeeds = req.MinTwoSeeds

    if req.TimeoutMs >= 1000 {
      cfg.TimeoutMs = req.TimeoutMs
    }
    limit := req.MaxResults
    if limit <= 0 {
      limit = 60
    }

    resp := executeOmniSearchWithConfig(req.Query, cfg, limit)
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    _ = json.NewEncoder(w).Encode(resp)
  })

  srv := &http.Server{
    Addr:         listenAddr,
    Handler:      mux,
    ReadTimeout:  10 * time.Second,
    WriteTimeout: 25 * time.Second,
  }
  return srv.ListenAndServe()
}

func tokenize(s string) []string {
  return strings.FieldsFunc(s, func(r rune) bool {
    return !unicode.IsLetter(r) && !unicode.IsDigit(r)
  })
}

func cleanTitle(s string) string {
  s = htmlTagRegex.ReplaceAllString(s, "")
  return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func extractInfoHash(magnet string) string {
  m := infoHashRegex.FindStringSubmatch(magnet)
  if len(m) > 1 {
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

func buildMagnet(hash, title string) string {
  var trParams strings.Builder
  for _, tr := range udpTrackers {
    trParams.WriteString("&tr=" + url.QueryEscape("udp://"+tr+"/announce"))
  }
  return fmt.Sprintf("magnet:?xt=urn:btih:%s&dn=%s%s", hash, url.QueryEscape(title), trParams.String())
}

func formatBytes(b int64) string {
  if b <= 0 {
    return "0 MB"
  }
  const unit = 1024
  if b < unit {
    return fmt.Sprintf("%d B", b)
  }
  div, exp := int64(unit), 0
  for n := b / unit; n >= unit; n /= unit {
    div *= unit
    exp++
  }
  return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func main() {
  addr := "127.0.0.1:18998"
  if len(os.Args) > 1 {
    if os.Args[1] == "--serve" {
      if len(os.Args) > 2 {
        addr = os.Args[2]
      }
      _ = StartOmniHTTPServer(addr)
      return
    }
    cfgMu.RLock()
    cfg := globalConfig
    cfgMu.RUnlock()
    resp := executeOmniSearchWithConfig(strings.Join(os.Args[1:], " "), cfg, 40)
    enc := json.NewEncoder(os.Stdout)
    enc.SetIndent("", "  ")
    _ = enc.Encode(resp)
    return
  }
  _ = StartOmniHTTPServer(addr)
}
