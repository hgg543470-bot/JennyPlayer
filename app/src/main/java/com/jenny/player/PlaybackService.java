package com.jenny.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PlaybackService extends Service {
    public static final String CHANNEL_ID = "jenny_media_channel";
    private static final int NOTIF_ID = 101;

    public static final String ACTION_UPDATE = "com.jenny.player.ACTION_UPDATE";
    public static final String ACTION_PREV = "com.jenny.player.ACTION_PREV";
    public static final String ACTION_PLAY_PAUSE = "com.jenny.player.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.jenny.player.ACTION_NEXT";

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private String currentTitle = "Jenny Player • Студия активна";
    private String currentSubtitle = "🛡️ Фоновый движок 24/7 (P2P + 32-bit DSP)";
    private boolean isPlaying = true;
    private long currentPosMs = 0;
    private long currentDurMs = 0;
    private float currentSpeed = 1.0f;

    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Jenny Player & P2P Engine", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Постоянная работа плеера и P2P-торрента в фоне без засыпания");
            channel.setShowBadge(false);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
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
        ensureChannel(this);
        acquireAllLocksV212();

        mediaSession = new MediaSession(this, "JennyPlayerSession");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                MainActivity.evalJs("if(window.togglePlay) window.togglePlay();");
            }

            @Override
            public void onPause() {
                MainActivity.evalJs("if(window.togglePlay) window.togglePlay();");
            }

            @Override
            public void onSkipToNext() {
                MainActivity.evalJs("if(window.playNextTrack) window.playNextTrack();");
            }

            @Override
            public void onSkipToPrevious() {
                MainActivity.evalJs("if(window.playPreviousTrack) window.playPreviousTrack();");
            }

            @Override
            public void onSeekTo(long pos) {
                double sec = pos / 1000.0;
                MainActivity.evalJs("if(window.seekFromNotification) window.seekFromNotification(" + sec + ");");
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        acquireAllLocksV212();

        if (intent != null && intent.getAction() != null) {
            String act = intent.getAction();
            if (ACTION_PREV.equals(act)) {
                MainActivity.evalJs("if(window.playPreviousTrack) window.playPreviousTrack();");
                return START_STICKY;
            } else if (ACTION_PLAY_PAUSE.equals(act)) {
                MainActivity.evalJs("if(window.togglePlay) window.togglePlay();");
                return START_STICKY;
            } else if (ACTION_NEXT.equals(act)) {
                MainActivity.evalJs("if(window.playNextTrack) window.playNextTrack();");
                return START_STICKY;
            } else if (ACTION_UPDATE.equals(act)) {
                String t = intent.getStringExtra("title");
                String sub = intent.getStringExtra("subtitle");
                if (t != null && !t.isEmpty()) {
                    if ((sub == null || sub.isEmpty()) && t.contains(" || ")) {
                        String[] parts = t.split(" \\|\\| ", 2);
                        currentTitle = parts[0];
                        currentSubtitle = parts[1];
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
            }
        }

        updateMediaSessionState();
        Notification notification = buildNotification();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, notification);
            }
        } catch (Throwable ignored) {}

        return START_STICKY;
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

    private Notification buildNotification() {
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

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseLabel = isPlaying ? "Pause" : "Play";

        Notification.Builder builder = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        Notification.MediaStyle style = new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);

        builder.setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
                .setContentTitle(currentTitle)
                .setContentText(currentSubtitle)
                .setSubText("🛡️ Работа в фоне 24/7")
                .setContentIntent(contentPending)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Prev", prevPending).build())
                .addAction(new Notification.Action.Builder(playPauseIcon, playPauseLabel, playPausePending).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Next", nextPending).build())
                .setStyle(style);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
            } catch (Throwable ignored) {}
        }

        return builder.build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        acquireAllLocksV212();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
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
