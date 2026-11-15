// theme rules shared by scripts. first match wins (ordered).
const RULES = [
  ['net', /routeJennyApiUrl|pickJennyPort|ClusterPorts|stripJennyLocalOrigin|_nativeFetch|^fetch$|XhrOpen|MultiPort|InternalMediaSrc/],
  ['video_reverse', /(Vid|Video|DeckB|V21[0-9]|V22[0-9]).*(Rev|Reverse)|(Rev|Reverse).*(Vid|Video|DeckB|Chunk|Segment|Blob)|RevRam|RamRev|ReverseRam|RevQueue|RevSeg|RevPause/],
  ['framegen', /Framegen|FrameGen|Fg[A-Z]|120Hz|Motion|Interp|Dedup|Pyramid|Lab[A-Z]|JennyLab|Exp120|Viewport/],
  ['torrent', /Torrent|Tor[A-Z]|tor[A-Z]|Magnet|Tracker|Omni|P2p|p2p|Piece|Seed|Btih|Spiderweb|Nuke|Daemon/],
  ['video', /Video|Vid[A-Z_]|vid[A-Z]|DeckB|Deck[_]?B|Pip|PiP|Overlay|Movie|Fullscreen|Hud|HUD|Remux|Rotate|FitMode|DualDeck|ActiveUiDeck|UiDeck|Deck[A-Z]|deck[A-Z]/],
  ['sources', /Kh[A-Z]|kh[A-Z]|Khinsider|Ost[A-Z]|OST|Radio|radio|SoundCloud|Sc[A-Z]|sc[A-Z]|Yt[A-Z]|yt[A-Z]|YouTube|Youtube|Source|SOURCES|MiniPlayer|Ump|ump|Archive|ARCHIVE|ExternalStream|NEON|Hub[A-Z]|HubPill/],
  ['reverse', /Reverse|Rev[A-Z]|rev[A-Z]|Horizon|horizon|Gearbox|Gear[A-Z]|Ram[A-Z]|RAM|Dna|dna|DNA|Clock|Jbuf|JBuf|PitchShift|StudioBuffer|Scrub|scrub|Splic|Vinyl|TruePlaybackTime|ExactPlaybackPosition|PendingSeek|BufferSources|Turbo|Stall|Telemetry|WindowBuffer|MasterPlaybackEngine|Speed|Arc[A-Z]|arc[A-Z]/],
  ['shade', /Notification|MediaSession|mediaSession|Foreground|Wake|Background|SafeInset/],
  ['export', /Export|export|Xflac|xflac|XFLAC|Encoding|SampleRate/],
  ['playlist', /Playlist|PLAYLIST|playlist|Tab[A-Z]|Sort|SORT|Tag[A-Z]|Tags|filterTracks|TrackCount|TrackMeta|TrackRow|TrackAdd|TrackDelete|TrackIn|Folder|folder|SubFilter|SubStrip|SubGroup|SubModal|Strip|Queue|queue|Fav|fav|fetchData|Search|search|selectedArtist|selectedAlbum|RowAction|MetaTag|viewedFull|Chip|normSearch|Locat/],
  ['transport', /playTrack|togglePlay|playNext|playPrev|handleTrackPlay|Seek|seek|Pause|pause|PlayIntent|Playing|DeckA|Stop[A-Z]|stop[A-Z]/],
  ['gestures', /Gesture|gesture|LongPress|Hold[A-Z]|hold[A-Z]|Touch|InputFocus|FocusGuard/],
  ['settings', /Settings|settings|Lang|lang|Theme|Config|config|Format|FORMAT|Slot|Thread|Onb|Onboard|Help|Guide|Permission|Modal|modal|Header|header|prompt|Dropdown|Storage|Eq[A-Z]|EQ/],
];
function themeOfName(n) { n = n.replace(/Editor|Monitor|Inspector|Selector|Generator|Extractor|Locator|Indicator|History|Factory|Restore|Stored?|Vector|Motor|Actor|Factor/g, ''); for (const [t, re] of RULES) if (re.test(n)) return t; return ''; }
module.exports = { RULES, themeOfName };
