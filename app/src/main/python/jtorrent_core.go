// JennyPlayer Go Torrent Engine v2.0 (anacrolix/torrent + RAM PieceMap + Swarm Diagnostics)
// Compile in Termux:
//   CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o libjtorrent.so jtorrent_core.go

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"
)

type ManagedTorrent struct {
	mu           sync.Mutex
	t            *torrent.Torrent
	hash         string
	magnet       string
	metaSource   string
	paused       bool
	selected     map[int]bool
	boostedFile  int
	boostedPiece map[int]time.Time
	lastWireRead int64
	lastSpeedTs  time.Time
	lastDataTs   time.Time
	addedTs      time.Time
	speedKbps    int
}

var (
	client   *torrent.Client
	dataDir  string
	torMu    sync.RWMutex
	torrents = make(map[string]*ManagedTorrent)
	btihRe   = regexp.MustCompile(`(?i)btih:([a-f0-9]{40})`)
)

func initAndroidDNS() {
	dialer := &net.Dialer{Timeout: 2500 * time.Millisecond}
	net.DefaultResolver = &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			c, err := dialer.DialContext(ctx, "udp", "8.8.8.8:53")
			if err != nil {
				return dialer.DialContext(ctx, "udp", "1.1.1.1:53")
			}
			return c, nil
		},
	}
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func countDhtNodes() int {
	if client == nil {
		return 0
	}
	total := 0
	for _, ds := range client.DhtServers() {
		v := reflect.ValueOf(ds.Stats())
		if v.Kind() == reflect.Ptr && !v.IsNil() {
			v = v.Elem()
		}
		if v.Kind() == reflect.Struct {
			if f := v.FieldByName("GoodNodes"); f.IsValid() && f.Kind() == reflect.Int {
				if gn := int(f.Int()); gn > 0 {
					total += gn
					continue
				}
			}
			if f := v.FieldByName("Nodes"); f.IsValid() && f.Kind() == reflect.Int {
				total += int(f.Int())
			}
		}
	}
	return total
}

func fetchTorrentCacheByHash(ctx context.Context, hash string) ([]byte, string) {
	up := strings.ToUpper(strings.TrimSpace(hash))
	if len(up) != 40 {
		return nil, ""
	}
	urls := []struct{ name, u string }{
		{"iTorrents", "https://itorrents.org/torrent/" + up + ".torrent"},
		{"BTCache", "https://btcache.me/torrent/" + up},
	}
	type hit struct {
		b   []byte
		src string
	}
	ch := make(chan hit, len(urls))
	hc := &http.Client{Timeout: 3500 * time.Millisecond}
	for _, item := range urls {
		go func(name, u string) {
			req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
			if err != nil {
				return
			}
			req.Header.Set("User-Agent", "Mozilla/5.0")
			resp, err := hc.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode != 200 {
				return
			}
			raw, err := io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024))
			if err != nil || len(raw) < 64 || raw[0] != 'd' {
				return
			}
			mi, err := metainfo.Load(bytes.NewReader(raw))
			if err == nil && strings.EqualFold(mi.HashInfoBytes().HexString(), hash) {
				ch <- hit{b: raw, src: name}
			}
		}(item.name, item.u)
	}
	select {
	case res := <-ch:
		return res.b, res.src
	case <-ctx.Done():
		return nil, ""
	}
}

func addTrackersToTorrent(t *torrent.Torrent, trackers []string) {
	if t == nil || len(trackers) == 0 {
		return
	}
	var tier []string
	seen := make(map[string]bool)
	for _, tr := range trackers {
		tr = strings.TrimSpace(tr)
		if tr != "" && !seen[tr] {
			seen[tr] = true
			tier = append(tier, tr)
		}
	}
	if len(tier) > 0 {
		t.AddTrackers([][]string{tier})
	}
}

func registerManaged(t *torrent.Torrent, mag, metaSrc string) *ManagedTorrent {
	h := strings.ToLower(t.InfoHash().HexString())
	torMu.Lock()
	defer torMu.Unlock()
	now := time.Now()
	mt, ok := torrents[h]
	if !ok {
		mt = &ManagedTorrent{
			t:            t,
			hash:         h,
			magnet:       mag,
			metaSource:   metaSrc,
			selected:     make(map[int]bool),
			boostedFile:  -1,
			boostedPiece: make(map[int]time.Time),
			lastSpeedTs:  now,
			lastDataTs:   now,
			addedTs:      now,
		}
		torrents[h] = mt
	} else {
		mt.t = t
		if mag != "" {
			mt.magnet = mag
		}
		if metaSrc != "" {
			mt.metaSource = metaSrc
		}
	}
	return mt
}

func findOrRestoreTorrent(hash, magnetHint string, trackers []string) (*ManagedTorrent, error) {
	h := strings.ToLower(strings.TrimSpace(hash))
	torMu.RLock()
	mt, ok := torrents[h]
	torMu.RUnlock()
	if ok && mt.t != nil {
		addTrackersToTorrent(mt.t, trackers)
		return mt, nil
	}
	savedTor := filepath.Join(dataDir, h+".torrent")
	if st, err := os.Stat(savedTor); err == nil && st.Size() > 32 {
		t, err := client.AddTorrentFromFile(savedTor)
		if err == nil {
			addTrackersToTorrent(t, trackers)
			return registerManaged(t, magnetHint, "disk_cache"), nil
		}
	}
	mag := strings.TrimSpace(magnetHint)
	if mag == "" && len(h) == 40 {
		mag = "magnet:?xt=urn:btih:" + h
	}
	if mag != "" {
		t, err := client.AddMagnet(mag)
		if err == nil {
			addTrackersToTorrent(t, trackers)
			return registerManaged(t, mag, "dht_magnet"), nil
		}
		return nil, err
	}
	return nil, fmt.Errorf("раздача %s не найдена", h)
}

func prioritizeBoundaries(t *torrent.Torrent, f *torrent.File, highHead bool) {
	if t == nil || f == nil || t.Info() == nil {
		return
	}
	np := t.NumPieces()
	beg := f.BeginPieceIndex()
	end := f.EndPieceIndex()
	if beg < 0 || beg >= np {
		return
	}
	if end > np {
		end = np
	}
	prio := torrent.PiecePriorityHigh
	if highHead {
		prio = torrent.PiecePriorityNow
	}
	for p := beg; p < beg+2 && p < end; p++ {
		if !t.PieceState(p).Complete {
			t.Piece(p).SetPriority(prio)
		}
	}
	if end-1 >= beg && !t.PieceState(end-1).Complete {
		t.Piece(end - 1).SetPriority(prio)
	}
}

func updateConveyorIfNeeded(mt *ManagedTorrent) int {
	t := mt.t
	if t == nil || t.Info() == nil {
		return -1
	}
	np := t.NumPieces()
	if np <= 0 {
		return -1
	}
	if mt.paused {
		t.CancelPieces(0, np)
		return -1
	}

	files := t.Files()
	leadIdx := -1
	secondIdx := -1

	if mt.boostedFile >= 0 && mt.boostedFile < len(files) && mt.selected[mt.boostedFile] {
		bf := files[mt.boostedFile]
		if bf.BytesCompleted() < bf.Length() {
			leadIdx = mt.boostedFile
		}
	}
	for i, f := range files {
		if !mt.selected[i] || f.BytesCompleted() >= f.Length() {
			continue
		}
		if leadIdx == -1 {
			leadIdx = i
		} else if i != leadIdx && secondIdx == -1 {
			secondIdx = i
			break
		}
	}

	want := make([]torrent.PiecePriority, np)
	for i, f := range files {
		if !mt.selected[i] {
			continue
		}
		beg, end := f.BeginPieceIndex(), f.EndPieceIndex()
		if beg < 0 {
			beg = 0
		}
		if end > np {
			end = np
		}
		baseP := torrent.PiecePriorityNormal
		if i == leadIdx {
			baseP = torrent.PiecePriorityHigh
		} else if i == secondIdx {
			baseP = torrent.PiecePriorityReadahead
		}
		for p := beg; p < end; p++ {
			if baseP > want[p] {
				want[p] = baseP
			}
		}
	}

	if leadIdx >= 0 && leadIdx < len(files) {
		lf := files[leadIdx]
		beg, end := lf.BeginPieceIndex(), lf.EndPieceIndex()
		if end > np {
			end = np
		}
		ahead := 0
		for p := beg; p < end && ahead < 6; p++ {
			if !t.PieceState(p).Complete {
				if ahead == 0 {
					want[p] = torrent.PiecePriorityNow
				} else {
					want[p] = torrent.PiecePriorityNext
				}
				ahead++
			}
		}
		if end-1 >= beg && !t.PieceState(end-1).Complete && want[end-1] < torrent.PiecePriorityNext {
			want[end-1] = torrent.PiecePriorityNext
		}
	}

	now := time.Now()
	for pIdx, ts := range mt.boostedPiece {
		if now.Sub(ts) > 25*time.Second || pIdx < 0 || pIdx >= np || t.PieceState(pIdx).Complete {
			delete(mt.boostedPiece, pIdx)
			continue
		}
		want[pIdx] = torrent.PiecePriorityNow
	}

	for p := 0; p < np; p++ {
		ps := t.PieceState(p)
		if ps.Complete {
			continue
		}
		if ps.Priority != want[p] {
			t.Piece(p).SetPriority(want[p])
		}
	}
	return leadIdx
}

func buildPiecesMapString(t *torrent.Torrent) (string, int, int) {
	if t == nil || t.Info() == nil {
		return "", 0, 0
	}
	np := t.NumPieces()
	buf := make([]byte, np)
	doneCnt := 0
	partCnt := 0
	for i := 0; i < np; i++ {
		ps := t.PieceState(i)
		switch {
		case ps.Complete:
			buf[i] = '4'
			doneCnt++
		case ps.Partial:
			buf[i] = '3'
			partCnt++
		case ps.Priority >= torrent.PiecePriorityHigh:
			buf[i] = '2'
		case ps.Priority > torrent.PiecePriorityNone:
			buf[i] = '1'
		default:
			buf[i] = '0'
		}
	}
	return string(buf), doneCnt, partCnt
}

func buildFilesResponse(mt *ManagedTorrent, leadIdx int) ([]map[string]interface{}, []map[string]interface{}, bool) {
	t := mt.t
	if t == nil || t.Info() == nil {
		return []map[string]interface{}{}, []map[string]interface{}{}, false
	}
	files := t.Files()
	selOut := make([]map[string]interface{}, 0, len(files))
	allOut := make([]map[string]interface{}, 0, len(files))
	allSelDone := len(mt.selected) > 0

	for i, f := range files {
		fLen := f.Length()
		fComp := f.BytesCompleted()
		if fComp > fLen {
			fComp = fLen
		}
		isDone := fLen > 0 && fComp >= fLen
		pct := 0
		if isDone {
			pct = 100
		} else if fLen > 0 {
			pct = int((fComp * 100) / fLen)
			if pct > 99 {
				pct = 99
			}
		}
		isSel := mt.selected[i]
		if isSel && !isDone {
			allSelDone = false
		}
		fullP := filepath.Join(dataDir, filepath.FromSlash(f.Path()))
		item := map[string]interface{}{
			"index":       i,
			"path":        f.DisplayPath(),
			"full_path":   fullP,
			"length":      fLen,
			"size":        fLen,
			"completed":   fComp,
			"percent":     pct,
			"done":        isDone,
			"selected":    isSel,
			"is_lead":     i == leadIdx && !isDone,
			"begin_piece": f.BeginPieceIndex(),
			"end_piece":   f.EndPieceIndex(),
		}
		allOut = append(allOut, item)
		if isSel {
			selOut = append(selOut, item)
		}
	}
	return selOut, allOut, allSelDone
}

func buildSwarmDiagnosis(mt *ManagedTorrent, dhtNodes, seeds, activePeers, halfOpen, totalPeers, partPieces int, hasInfo, allDone bool, idleMs int64) (string, string, string) {
	if !hasInfo {
		if dhtNodes == 0 && totalPeers == 0 {
			return "metadata", "warn", "📡 Поиск узлов DHT и трекеров (0 узлов — проверь UDP / VPN)"
		}
		if activePeers == 0 && (totalPeers > 0 || halfOpen > 0) {
			return "metadata", "warn", fmt.Sprintf("🔎 Найдено пиров: %d (полуоткр: %d), пробиваем NAT за оглавлением...", totalPeers, halfOpen)
		}
		return "metadata", "ok", fmt.Sprintf("🧲 Загрузка оглавления раздачи (пиров: %d, DHT: %d)...", activePeers, dhtNodes)
	}
	if mt.paused {
		return "paused", "warn", "⏸ Раздача на паузе"
	}
	if allDone {
		return "done", "ok", "✅ Выбранные файлы полностью скачаны (100%)"
	}
	if len(mt.selected) == 0 {
		return "idle", "ok", "📋 Оглавление готово — выбери файлы для потока ▶ или скачивания ⬇️"
	}
	if mt.speedKbps > 0 || idleMs < 3500 {
		return "downloading", "ok", fmt.Sprintf("⚡ Приём данных: %d КБ/с (сидов: %d, пиров: %d, кусков в работе: %d)", mt.speedKbps, seeds, activePeers, partPieces)
	}
	if totalPeers == 0 && dhtNodes == 0 {
		return "stalled", "dead", "🚫 P2P-сеть недоступна: 0 узлов DHT и 0 ответов трекеров (режется UDP)"
	}
	if totalPeers == 0 && dhtNodes > 0 {
		return "stalled", "dead", fmt.Sprintf("🏜️ В рое 0 раздающих (DHT живой: %d узл.) — раздача пустая", dhtNodes)
	}
	if activePeers == 0 && (totalPeers > 0 || halfOpen > 0) {
		return "connecting", "warn", fmt.Sprintf("🧱 Видно %d пиров в рое, но 0 соединений (закрыт NAT у пиров или фильтр P2P)", totalPeers)
	}
	if activePeers > 0 && seeds == 0 {
		return "stalled", "dead", fmt.Sprintf("⚠️ Подключено пиров: %d, но сидов со 100%% файла сейчас нет", activePeers)
	}
	return "connecting", "warn", fmt.Sprintf("⏳ Сидов на связи: %d (простой %dс) — ждём свободный слот отдачи...", seeds, idleMs/1000)
}

func speedTracker() {
	ticker := time.NewTicker(900 * time.Millisecond)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		torMu.RLock()
		list := make([]*ManagedTorrent, 0, len(torrents))
		for _, mt := range torrents {
			list = append(list, mt)
		}
		torMu.RUnlock()

		for _, mt := range list {
			mt.mu.Lock()
			if mt.t != nil {
				st := mt.t.Stats()
				wireBytes := st.BytesReadData.Int64()
				dt := now.Sub(mt.lastSpeedTs).Seconds()
				if dt >= 0.4 {
					delta := wireBytes - mt.lastWireRead
					if delta < 0 {
						delta = 0
					}
					instKbps := int(float64(delta) / 1024.0 / dt)
					if delta > 0 {
						mt.lastDataTs = now
					}
					if mt.paused {
						mt.speedKbps = 0
					} else if instKbps > 0 {
						mt.speedKbps = (mt.speedKbps*3 + instKbps*7) / 10
						if mt.speedKbps == 0 {
							mt.speedKbps = 1
						}
					} else if now.Sub(mt.lastDataTs) > 2500*time.Millisecond {
						mt.speedKbps = 0
					} else {
						mt.speedKbps = mt.speedKbps / 2
					}
					mt.lastWireRead = wireBytes
					mt.lastSpeedTs = now
				}
				if !mt.paused && mt.t.Info() != nil && len(mt.selected) > 0 {
					updateConveyorIfNeeded(mt)
				}
			}
			mt.mu.Unlock()
		}
	}
}

func handleAdd(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Magnet      string   `json:"magnet"`
		TorrentPath string   `json:"torrent_path"`
		Trackers    []string `json:"trackers"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	var (
		t       *torrent.Torrent
		err     error
		metaSrc = "dht_peers"
	)

	if req.TorrentPath != "" {
		if st, sErr := os.Stat(req.TorrentPath); sErr == nil && st.Size() > 32 {
			t, err = client.AddTorrentFromFile(req.TorrentPath)
			metaSrc = "torrent_file"
		}
	}

	if t == nil && req.Magnet != "" {
		m := btihRe.FindStringSubmatch(req.Magnet)
		btih := ""
		if len(m) >= 2 {
			btih = strings.ToLower(m[1])
			diskTor := filepath.Join(dataDir, btih+".torrent")
			if st, sErr := os.Stat(diskTor); sErr == nil && st.Size() > 32 {
				if tf, fErr := client.AddTorrentFromFile(diskTor); fErr == nil {
					t = tf
					metaSrc = "disk_cache"
				}
			}
		}

		if t == nil {
			t, err = client.AddMagnet(req.Magnet)
			if err != nil {
				writeJSON(w, 400, map[string]interface{}{"status": "error", "error": err.Error()})
				return
			}
			addTrackersToTorrent(t, req.Trackers)

			if btih != "" && t.Info() == nil {
				go func(hash string, trList []string) {
					cCtx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
					defer cancel()
					if rawTor, srcName := fetchTorrentCacheByHash(cCtx, hash); len(rawTor) > 0 {
						saveP := filepath.Join(dataDir, hash+".torrent")
						_ = os.WriteFile(saveP, rawTor, 0644)
						if mi, lErr := metainfo.Load(bytes.NewReader(rawTor)); lErr == nil {
							if t2, aErr := client.AddTorrent(mi); aErr == nil {
								addTrackersToTorrent(t2, trList)
								registerManaged(t2, req.Magnet, "web_cache:"+srcName)
							}
						}
					}
				}(btih, req.Trackers)
			}
		}
	}

	if t == nil {
		msg := "Не передана magnet-ссылка или .torrent файл"
		if err != nil {
			msg = err.Error()
		}
		writeJSON(w, 400, map[string]interface{}{"status": "error", "error": msg})
		return
	}

	addTrackersToTorrent(t, req.Trackers)
	mt := registerManaged(t, req.Magnet, metaSrc)

	select {
	case <-t.GotInfo():
	case <-time.After(25 * time.Second):
		dhtCnt := countDhtNodes()
		st := t.Stats()
		writeJSON(w, 200, map[string]interface{}{
			"status": "error",
			"error":  fmt.Sprintf("Таймаут оглавления (DHT узлов: %d, найдено пиров: %d, активных: %d)", dhtCnt, st.TotalPeers, st.ActivePeers),
		})
		return
	}

	if mi := t.Metainfo(); mi.InfoBytes != nil {
		saveP := filepath.Join(dataDir, mt.hash+".torrent")
		if _, sErr := os.Stat(saveP); os.IsNotExist(sErr) {
			if fOut, cErr := os.Create(saveP); cErr == nil {
				_ = mi.Write(fOut)
				_ = fOut.Close()
			}
		}
	}

	mt.mu.Lock()
	if len(mt.selected) == 0 {
		t.CancelPieces(0, t.NumPieces())
	} else {
		updateConveyorIfNeeded(mt)
	}
	_, allFiles, _ := buildFilesResponse(mt, -1)
	mt.mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{
		"status":      "ok",
		"hash":        mt.hash,
		"name":        t.Name(),
		"meta_source": mt.metaSource,
		"files":       allFiles,
	})
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Hash     string   `json:"hash"`
		Magnet   string   `json:"magnet"`
		Files    []int    `json:"files"`
		Trackers []string `json:"trackers"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	mt, err := findOrRestoreTorrent(req.Hash, req.Magnet, req.Trackers)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"status": "error", "error": err.Error()})
		return
	}
	select {
	case <-mt.t.GotInfo():
	case <-time.After(15 * time.Second):
		writeJSON(w, 200, map[string]interface{}{"status": "error", "error": "Ожидание метаданных раздачи"})
		return
	}

	mt.mu.Lock()
	mt.paused = false
	mt.selected = make(map[int]bool, len(req.Files))
	for _, idx := range req.Files {
		mt.selected[idx] = true
	}
	lead := updateConveyorIfNeeded(mt)
	if lead >= 0 && lead < len(mt.t.Files()) {
		prioritizeBoundaries(mt.t, mt.t.Files()[lead], true)
	}
	mt.mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{"status": "ok", "hash": mt.hash, "selected": len(req.Files)})
}

func handleControl(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Hash       string `json:"hash"`
		Action     string `json:"action"`
		FileIndex  int    `json:"file_index"`
		PieceIndex int    `json:"piece_index"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	h := strings.ToLower(strings.TrimSpace(req.Hash))
	act := strings.ToLower(strings.TrimSpace(req.Action))

	torMu.RLock()
	mt, ok := torrents[h]
	torMu.RUnlock()
	if !ok || mt == nil || mt.t == nil {
		writeJSON(w, 200, map[string]interface{}{"status": "ok"})
		return
	}

	mt.mu.Lock()
	switch act {
	case "pause":
		mt.paused = true
		mt.speedKbps = 0
		if mt.t.Info() != nil {
			mt.t.CancelPieces(0, mt.t.NumPieces())
		}
	case "resume":
		mt.paused = false
		mt.lastDataTs = time.Now()
		updateConveyorIfNeeded(mt)
	case "drop":
		mt.t.Drop()
		mt.mu.Unlock()
		torMu.Lock()
		delete(torrents, h)
		torMu.Unlock()
		writeJSON(w, 200, map[string]interface{}{"status": "ok"})
		return
	case "boost_file":
		mt.paused = false
		mt.selected[req.FileIndex] = true
		mt.boostedFile = req.FileIndex
		if mt.t.Info() != nil && req.FileIndex >= 0 && req.FileIndex < len(mt.t.Files()) {
			prioritizeBoundaries(mt.t, mt.t.Files()[req.FileIndex], true)
		}
		updateConveyorIfNeeded(mt)
	case "boost_piece":
		mt.paused = false
		if mt.t.Info() != nil && req.PieceIndex >= 0 && req.PieceIndex < mt.t.NumPieces() {
			mt.boostedPiece[req.PieceIndex] = time.Now()
			if !mt.t.PieceState(req.PieceIndex).Complete {
				mt.t.Piece(req.PieceIndex).SetPriority(torrent.PiecePriorityNow)
			}
		}
	}
	mt.mu.Unlock()
	writeJSON(w, 200, map[string]interface{}{"status": "ok"})
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	h := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("hash")))
	fIdx := 0
	fmt.Sscanf(r.URL.Query().Get("file"), "%d", &fIdx)

	mt, err := findOrRestoreTorrent(h, "", nil)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}
	select {
	case <-mt.t.GotInfo():
	case <-r.Context().Done():
		return
	case <-time.After(20 * time.Second):
		http.Error(w, "Metadata timeout", 504)
		return
	}

	files := mt.t.Files()
	if fIdx < 0 || fIdx >= len(files) {
		http.Error(w, "File index out of range", 404)
		return
	}
	target := files[fIdx]

	mt.mu.Lock()
	mt.paused = false
	mt.selected[fIdx] = true
	mt.boostedFile = fIdx
	prioritizeBoundaries(mt.t, target, true)
	updateConveyorIfNeeded(mt)
	mt.mu.Unlock()

	tr := target.NewReader()
	defer tr.Close()
	tr.SetResponsive()

	ext := strings.ToLower(filepath.Ext(target.DisplayPath()))
	ra := int64(5 * 1024 * 1024)
	mimeMap := map[string]string{
		".flac": "audio/flac", ".wav": "audio/wav", ".mp3": "audio/mpeg",
		".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".opus": "audio/ogg",
		".mp4": "video/mp4", ".m4v": "video/mp4", ".mkv": "video/x-matroska",
		".webm": "video/webm", ".avi": "video/x-msvideo", ".mov": "video/quicktime",
	}
	if ext == ".mp4" || ext == ".mkv" || ext == ".webm" || ext == ".avi" || ext == ".mov" {
		ra = 16 * 1024 * 1024
	}
	tr.SetReadahead(ra)
	if ct, ok := mimeMap[ext]; ok {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, filepath.Base(target.DisplayPath()), time.Now(), tr)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	dhtNodes := countDhtNodes()
	torMu.RLock()
	list := make([]*ManagedTorrent, 0, len(torrents))
	for _, mt := range torrents {
		list = append(list, mt)
	}
	torMu.RUnlock()

	out := make([]map[string]interface{}, 0, len(list))
	now := time.Now()

	for _, mt := range list {
		mt.mu.Lock()
		t := mt.t
		if t == nil {
			mt.mu.Unlock()
			continue
		}
		st := t.Stats()
		hasInfo := t.Info() != nil
		name := mt.hash
		numPieces := 0
		pieceLen := int64(0)
		pMap, pDone, pPart := "", 0, 0
		leadIdx := -1
		if hasInfo {
			name = t.Name()
			numPieces = t.NumPieces()
			pieceLen = t.Info().PieceLength
			if !mt.paused && len(mt.selected) > 0 {
				if mt.boostedFile >= 0 {
					leadIdx = mt.boostedFile
				} else {
					for idx := range mt.selected {
						if leadIdx == -1 || idx < leadIdx {
							leadIdx = idx
						}
					}
				}
			}
			pMap, pDone, pPart = buildPiecesMapString(t)
		}
		selFiles, allFiles, allDone := buildFilesResponse(mt, leadIdx)
		idleMs := now.Sub(mt.lastDataTs).Milliseconds()
		stage, diagStatus, diagMsg := buildSwarmDiagnosis(
			mt, dhtNodes, st.ConnectedSeeders, st.ActivePeers, st.HalfOpenPeers, st.TotalPeers,
			pPart, hasInfo, allDone, idleMs,
		)

		out = append(out, map[string]interface{}{
			"hash":            mt.hash,
			"name":            name,
			"paused":          mt.paused,
			"seeders":         st.ConnectedSeeders,
			"peers":           st.ActivePeers,
			"half_open":       st.HalfOpenPeers,
			"pending_peers":   st.PendingPeers,
			"total_peers":     st.TotalPeers,
			"speed_kbps":      mt.speedKbps,
			"num_pieces":      numPieces,
			"piece_length":    pieceLen,
			"pieces_complete": pDone,
			"pieces_partial":  pPart,
			"pieces_map":      pMap,
			"dht_nodes":       dhtNodes,
			"meta_source":     mt.metaSource,
			"last_data_ms":    idleMs,
			"stage":           stage,
			"diag_status":     diagStatus,
			"diag_msg":        diagMsg,
			"files":           selFiles,
			"all_files":       allFiles,
		})
		mt.mu.Unlock()
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":    "ok",
		"version":   "2.0-diag",
		"dht_nodes": dhtNodes,
		"torrents":  out,
	})
}

func handleKillAll(w http.ResponseWriter, r *http.Request) {
	torMu.Lock()
	for h, mt := range torrents {
		if mt != nil && mt.t != nil {
			mt.t.Drop()
		}
		delete(torrents, h)
	}
	torMu.Unlock()
	writeJSON(w, 200, map[string]interface{}{"status": "ok"})
}

func main() {
	port := flag.String("port", "18081", "HTTP daemon port")
	dir := flag.String("dir", "/storage/emulated/0/Music/torrents_tmp", "Download directory")
	flag.Parse()

	initAndroidDNS()
	dataDir = *dir
	_ = os.MkdirAll(dataDir, 0755)

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = dataDir
	cfg.DefaultStorage = storage.NewFileOpts(storage.NewFileClientOpts{
		ClientBaseDir:   dataDir,
		PieceCompletion: storage.NewMapPieceCompletion(),
	})
	cfg.ListenPort = 0
	cfg.Seed = false
	cfg.NoUpload = false
	cfg.DisableIPv6 = false
	cfg.EstablishedConnsPerTorrent = 80
	cfg.HalfOpenConnsPerTorrent = 35
	cfg.HeaderObfuscationPolicy = torrent.HeaderObfuscationPolicy{
		Preferred:        true,
		RequirePreferred: false,
	}

	var err error
	client, err = torrent.NewClient(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "torrent client init err: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	go speedTracker()

	mux := http.NewServeMux()
	mux.HandleFunc("/add", handleAdd)
	mux.HandleFunc("/download", handleDownload)
	mux.HandleFunc("/control", handleControl)
	mux.HandleFunc("/stream", handleStream)
	mux.HandleFunc("/status", handleStatus)
	mux.HandleFunc("/kill_all", handleKillAll)

	srv := &http.Server{
		Addr:    "127.0.0.1:" + *port,
		Handler: mux,
	}
	_ = srv.ListenAndServe()
}
