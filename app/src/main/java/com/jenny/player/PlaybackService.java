package com.jenny.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PlaybackService extends Service {
    public static final String CHANNEL_ID = "jenny_media_channel";
    public static final String DATASYNC_CHANNEL_ID = "jenny_datasync_channel";
    private static final int NOTIF_ID = 101;
    private static final int NOTIF_DATASYNC_ID = 102;

    public static final String ACTION_UPDATE = "com.jenny.player.ACTION_UPDATE";
    public static final String ACTION_UPDATE_DATASYNC = "com.jenny.player.ACTION_UPDATE_DATASYNC";
    public static final String ACTION_TOGGLE_NOTIF_LOCK = "com.jenny.player.ACTION_TOGGLE_NOTIF_LOCK";
    public static final String ACTION_RESTORE_DISMISSED = "com.jenny.player.ACTION_RESTORE_DISMISSED";
    public static final String ACTION_STOP_DOWNLOADS = "com.jenny.player.ACTION_STOP_DOWNLOADS";
    public static final String ACTION_PREV = "com.jenny.player.ACTION_PREV";
    public static final String ACTION_PLAY_PAUSE = "com.jenny.player.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.jenny.player.ACTION_NEXT";
    public static final String ACTION_TOGGLE_ISLAND_EXPAND = "com.jenny.player.ACTION_TOGGLE_ISLAND_EXPAND";

    private static volatile PlaybackService sInstance;
    private static volatile boolean sLastAppInForeground = false;

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private IslandOverlayController islandOverlay;

    private String currentTitle = "Jenny Player • Студия активна";
    private String currentSubtitle = "🛡️ Фоновый движок 24/7 (P2P + 32-bit DSP)";
    private boolean isPlaying = false;
    private long currentPosMs = 0;
    private long currentDurMs = 0;
    private float currentSpeed = 1.0f;

    private boolean isDownloadActive = false;
    private String downloadTitle = "🧲 Загрузка в фоне (DataSync)";
    private String downloadStatus = "Фоновый сервис активен";
    private int downloadProgressPct = -1;
    private boolean isNotifLocked = true;

    public static void setAppInForegroundStatic(boolean inForeground) {
        sLastAppInForeground = inForeground;
        PlaybackService inst = sInstance;
        if (inst != null && inst.islandOverlay != null) {
            inst.islandOverlay.setAppInForeground(inForeground);
        }
    }

    public static void updateIslandExtraStatic(boolean isFav, String mode, String rawTrack) {
        PlaybackService inst = sInstance;
        if (inst != null && inst.islandOverlay != null) {
            inst.islandOverlay.updateExtraState(isFav, mode, rawTrack);
        }
    }

    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel mediaCh = new NotificationChannel(
                    CHANNEL_ID, "Jenny Player & Media Control", NotificationManager.IMPORTANCE_LOW);
            mediaCh.setDescription("Медиа-пульт воспроизведения Jenny Player");
            mediaCh.setShowBadge(false);
            nm.createNotificationChannel(mediaCh);

            NotificationChannel syncCh = new NotificationChannel(
                    DATASYNC_CHANNEL_ID, "Jenny P2P & DataSync Загрузки", NotificationManager.IMPORTANCE_LOW);
            syncCh.setDescription("Невыгружаемый сервис фоновых закачек P2P / xFLAC с кнопкой блокировки");
            syncCh.setShowBadge(false);
            nm.createNotificationChannel(syncCh);
        }
    }

    private void loadLockPref() {
        try {
            SharedPreferences sp = getSharedPreferences("jenny_service_prefs", MODE_PRIVATE);
            isNotifLocked = sp.getBoolean("notif_locked_v237", true);
        } catch (Throwable ignored) {}
    }

    private void saveLockPref(boolean locked) {
        isNotifLocked = locked;
        try {
            SharedPreferences sp = getSharedPreferences("jenny_service_prefs", MODE_PRIVATE);
            sp.edit().putBoolean("notif_locked_v237", locked).apply();
        } catch (Throwable ignored) {}
    }

    private void acquireAllLocksV212() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JennyPlayer::CoreWakeLockV212");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } catch (Throwable ignored) {}

        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int lockType = WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        lockType = WifiManager.WIFI_MODE_FULL_LOW_LATENCY;
                    }
                    wifiLock = wm.createWifiLock(lockType, "JennyPlayer::CoreWifiLockV212");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        loadLockPref();
        ensureChannel(this);
        acquireAllLocksV212();

        islandOverlay = new IslandOverlayController(this);
        islandOverlay.setAppInForeground(sLastAppInForeground);

        mediaSession = new MediaSession(this, "JennyPlayerSession");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('play',''); else if(window.explicitMediaSessionPlayV240) window.explicitMediaSessionPlayV240(); else if(window.togglePlay) window.togglePlay();");
            }

            @Override
            public void onPause() {
                isPlaying = false;
                updateMediaSessionState();
                if (islandOverlay != null) {
                    islandOverlay.updateMediaState(currentTitle, currentSubtitle, isPlaying, currentPosMs, currentDurMs, currentSpeed);
                }
                postAllNotifications();
                MainActivity.evalJs("if(window.explicitMediaSessionPauseV240) window.explicitMediaSessionPauseV240();");
            }

            @Override
            public void onStop() {
                isPlaying = false;
                updateMediaSessionState();
                if (islandOverlay != null) {
                    islandOverlay.updateMediaState(currentTitle, currentSubtitle, isPlaying, currentPosMs, currentDurMs, currentSpeed);
                }
                postAllNotifications();
                MainActivity.evalJs("if(window.explicitMediaSessionPauseV240) window.explicitMediaSessionPauseV240();");
            }

            @Override
            public void onSkipToNext() {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }

            @Override
            public void onSkipToPrevious() {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }

            @Override
            public void onSeekTo(long pos) {
                double sec = pos / 1000.0;
                currentPosMs = pos;
                if (islandOverlay != null) {
                    islandOverlay.onSeekTo(pos);
                }
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('seek','" + sec + "'); else if(window.seekFromNotification) window.seekFromNotification(" + sec + ");");
            }
        });
        mediaSession.setActive(false);

        islandOverlay.ensureAttached();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (islandOverlay != null) {
            islandOverlay.onConfigurationChanged();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        acquireAllLocksV212();

        if (intent != null && intent.getAction() != null) {
            String act = intent.getAction();
            if (ACTION_PREV.equals(act)) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
                return START_STICKY;
            } else if (ACTION_PLAY_PAUSE.equals(act)) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle',''); else if(window.togglePlay) window.togglePlay();");
                return START_STICKY;
            } else if (ACTION_NEXT.equals(act)) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
                return START_STICKY;
            } else if (ACTION_TOGGLE_ISLAND_EXPAND.equals(act)) {
                if (islandOverlay != null) {
                    islandOverlay.toggleExpanded();
                }
                postAllNotifications();
                return START_STICKY;
            } else if (ACTION_STOP_DOWNLOADS.equals(act)) {
                isDownloadActive = false;
                downloadProgressPct = -1;
                MainActivity.evalJs("if(window.stopCurrentOpenTorrentV143) window.stopCurrentOpenTorrentV143();");
                postAllNotifications();
                return START_STICKY;
            } else if (ACTION_TOGGLE_NOTIF_LOCK.equals(act)) {
                saveLockPref(!isNotifLocked);
                MainActivity.evalJs("if(window.onAndroidNotifLockChangedV237) window.onAndroidNotifLockChangedV237(" + isNotifLocked + ");");
                postAllNotifications();
                return START_STICKY;
            } else if (ACTION_RESTORE_DISMISSED.equals(act)) {
                if (isNotifLocked || isDownloadActive) {
                    postAllNotifications();
                }
                return START_STICKY;
            } else if (ACTION_UPDATE_DATASYNC.equals(act)) {
                isDownloadActive = intent.getBooleanExtra("dl_active", isDownloadActive);
                String dt = intent.getStringExtra("dl_title");
                String ds = intent.getStringExtra("dl_status");
                if (dt != null && !dt.isEmpty()) downloadTitle = dt;
                if (ds != null && !ds.isEmpty()) downloadStatus = ds;
                downloadProgressPct = intent.getIntExtra("dl_pct", downloadProgressPct);
                if (intent.hasExtra("notif_locked")) {
                    saveLockPref(intent.getBooleanExtra("notif_locked", isNotifLocked));
                }
                postAllNotifications();
                return START_STICKY;
            } else if (ACTION_UPDATE.equals(act)) {
                String t = intent.getStringExtra("title");
                String sub = intent.getStringExtra("subtitle");
                if (t != null && !t.isEmpty()) {
                    if ((sub == null || sub.isEmpty()) && t.contains(" || ")) {
                        int sepIdx = t.indexOf(" || ");
                        currentTitle = t.substring(0, sepIdx);
                        currentSubtitle = t.substring(sepIdx + 4);
                    } else {
                        currentTitle = t;
                    }
                }
                if (sub != null && !sub.isEmpty()) {
                    currentSubtitle = sub;
                }
                isPlaying = intent.getBooleanExtra("playing", isPlaying);
                currentPosMs = intent.getLongExtra("pos", currentPosMs);
                currentDurMs = intent.getLongExtra("dur", currentDurMs);
                currentSpeed = intent.getFloatExtra("speed", 1.0f);

                if (islandOverlay != null) {
                    if (intent.hasExtra("fav") || intent.hasExtra("mode") || intent.hasExtra("rawTrack")) {
                        islandOverlay.updateExtraState(
                                intent.getBooleanExtra("fav", false),
                                intent.getStringExtra("mode"),
                                intent.getStringExtra("rawTrack")
                        );
                    }
                }
                if (intent.hasExtra("dl_active")) {
                    isDownloadActive = intent.getBooleanExtra("dl_active", isDownloadActive);
                    downloadProgressPct = intent.getIntExtra("dl_pct", downloadProgressPct);
                }
            }
        }

        updateMediaSessionState();
        if (islandOverlay != null) {
            islandOverlay.updateMediaState(currentTitle, currentSubtitle, isPlaying, currentPosMs, currentDurMs, currentSpeed);
        }
        postAllNotifications();

        return START_STICKY;
    }

    private void postAllNotifications() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        boolean useDataSyncAsPrimaryForeground = (!isPlaying && isDownloadActive);

        Notification primaryNotif = useDataSyncAsPrimaryForeground
                ? buildDataSyncNotification()
                : buildMediaNotification();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int fgTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
                try {
                    fgTypes |= ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                } catch (Throwable ignored) {}
                try {
                    startForeground(NOTIF_ID, primaryNotif, fgTypes);
                } catch (Throwable e2) {
                    startForeground(NOTIF_ID, primaryNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                }
            } else {
                startForeground(NOTIF_ID, primaryNotif);
            }
        } catch (Throwable ignored) {}

        if (nm != null) {
            try {
                if (isDownloadActive && isPlaying) {
                    nm.notify(NOTIF_DATASYNC_ID, buildDataSyncNotification());
                } else if (!isDownloadActive) {
                    nm.cancel(NOTIF_DATASYNC_ID);
                }
            } catch (Throwable ignored) {}
        }
    }

    private void updateMediaSessionState() {
        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, currentSubtitle)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurMs > 0 ? currentDurMs : -1L);
        mediaSession.setMetadata(metaBuilder.build());

        long actions = PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT
                | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_SEEK_TO;

        int state = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState.Builder stateBuilder = new PlaybackState.Builder()
                .setActions(actions)
                .setState(state, currentPosMs, isPlaying ? currentSpeed : 0f);
        mediaSession.setPlaybackState(stateBuilder.build());
        try {
            mediaSession.setActive(isPlaying);
        } catch (Throwable ignored) {}
    }

    private PendingIntent buildRestoreDeleteIntent(int reqCode) {
        Intent restoreIntent = new Intent(this, PlaybackService.class).setAction(ACTION_RESTORE_DISMISSED);
        return PendingIntent.getService(
                this, reqCode, restoreIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent buildToggleLockIntent(int reqCode) {
        Intent lockIntent = new Intent(this, PlaybackService.class).setAction(ACTION_TOGGLE_NOTIF_LOCK);
        return PendingIntent.getService(
                this, reqCode, lockIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildDataSyncNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this, 10, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent lockPending = buildToggleLockIntent(11);
        PendingIntent stopDlPending = PendingIntent.getService(
                this, 12, new Intent(this, PlaybackService.class).setAction(ACTION_STOP_DOWNLOADS),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent playPausePending = PendingIntent.getService(
                this, 13, new Intent(this, PlaybackService.class).setAction(ACTION_PLAY_PAUSE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String lockLabel = isNotifLocked ? "🔒 Закреплено" : "🔓 Закрепить";
        int lockIcon = isNotifLocked ? android.R.drawable.ic_lock_lock : android.R.drawable.ic_partial_secure;

        Notification.Builder builder = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, DATASYNC_CHANNEL_ID)
                : new Notification.Builder(this);

        builder.setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(downloadTitle)
                .setContentText(downloadStatus)
                .setSubText(isNotifLocked ? "🔒 Защита от закрытия ВКЛ" : "🔓 Можно закрыть")
                .setContentIntent(contentPending)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(isNotifLocked || isDownloadActive)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setDeleteIntent(buildRestoreDeleteIntent(14))
                .addAction(new Notification.Action.Builder(lockIcon, lockLabel, lockPending).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "⏹ Стоп P2P", stopDlPending).build())
                .addAction(new Notification.Action.Builder(
                        isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        isPlaying ? "Пауза" : "Плей",
                        playPausePending).build());

        if (downloadProgressPct >= 0 && downloadProgressPct <= 100) {
            builder.setProgress(100, downloadProgressPct, false);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
            } catch (Throwable ignored) {}
        }

        Notification n = builder.build();
        if (isNotifLocked || isDownloadActive) {
            n.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR | Notification.FLAG_FOREGROUND_SERVICE;
        }
        return n;
    }

    private Notification buildMediaNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent prevPending = PendingIntent.getService(
                this, 1, new Intent(this, PlaybackService.class).setAction(ACTION_PREV),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent playPausePending = PendingIntent.getService(
                this, 2, new Intent(this, PlaybackService.class).setAction(ACTION_PLAY_PAUSE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent nextPending = PendingIntent.getService(
                this, 3, new Intent(this, PlaybackService.class).setAction(ACTION_NEXT),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent lockPending = buildToggleLockIntent(4);

        PendingIntent islandTogglePending = PendingIntent.getService(
                this, 5, new Intent(this, PlaybackService.class).setAction(ACTION_TOGGLE_ISLAND_EXPAND),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseLabel = isPlaying ? "Пауза" : "Пуск";
        int lockIcon = isNotifLocked ? android.R.drawable.ic_lock_lock : android.R.drawable.ic_partial_secure;
        String lockLabel = isNotifLocked ? "🔒 Закреплено" : "🔓 Закрепить";

        Notification.Builder builder = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        builder.setSmallIcon(isDownloadActive ? android.R.drawable.stat_sys_download : android.R.drawable.ic_lock_silent_mode_off)
                .setContentTitle(currentTitle)
                .setContentText(currentSubtitle)
                .setSubText(isNotifLocked ? "🔒 Заблокировано от закрытия" : "🛡️ Работа в фоне 24/7")
                .setContentIntent(contentPending)
                .setDeleteIntent(buildRestoreDeleteIntent(6))
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(isNotifLocked || isPlaying || isDownloadActive)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Пред", prevPending).build())
                .addAction(new Notification.Action.Builder(playPauseIcon, playPauseLabel, playPausePending).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "След", nextPending).build());

        boolean overlayActive = islandOverlay != null && islandOverlay.canDrawOverlay();
        if (!overlayActive) {
            Notification.MediaStyle style = new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2);
            builder.addAction(new Notification.Action.Builder(lockIcon, lockLabel, lockPending).build());
            builder.setStyle(style);
        } else {
            boolean exp = islandOverlay.isExpanded();
            String islandLabel = exp ? "▲ Свернуть плашку" : "▼ Развернуть плашку";
            builder.addAction(new Notification.Action.Builder(lockIcon, islandLabel, islandTogglePending).build());
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
            } catch (Throwable ignored) {}
        }

        Notification n = builder.build();
        if (isNotifLocked || isPlaying || isDownloadActive) {
            n.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR | Notification.FLAG_FOREGROUND_SERVICE;
        }
        return n;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        acquireAllLocksV212();
        if (isNotifLocked || isDownloadActive || isPlaying) {
            postAllNotifications();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (islandOverlay != null) {
            islandOverlay.destroy();
        }
        if (sInstance == this) {
            sInstance = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
