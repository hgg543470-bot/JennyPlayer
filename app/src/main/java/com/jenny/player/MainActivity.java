package com.jenny.player;
import android.view.WindowManager;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.system.Os;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import org.json.JSONObject;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;

public class MainActivity extends AppCompatActivity {
    private static final int REQ_PERM_STORAGE = 1;
    private static final int REQ_PERM_NOTIF = 2;
    private static final int REQ_PICK_FOLDER = 42;
    private static final int REQ_PICK_TORRENT = 43;
    private static final int REQ_OVERLAY_PERM = 44;
    // === BEGIN JENNY_V238_DIRECT_MEDIA_FIELDS ===
    private static final AtomicLong directMediaHitsV238 = new AtomicLong(0L);
    private static volatile long cachedPresetMtimeV238 = -1L;
    private static volatile List<String> cachedLookupDirsV238 = null;
    private static final Object presetCacheLockV238 = new Object();
    // === END JENNY_V238_DIRECT_MEDIA_FIELDS ===
    private static MainActivity instance;
    private static WebView webView;
    private static boolean isPageLoaded = false;
    private static String pendingTorrentPayload = null;
    private static String pendingTorrentName = null;
    // === JENNY_V220_JAVA_PATCH ===
    private static boolean isVideoFullscreenV132 = false;
    private static boolean isVideoLockedV132 = false;
    private static Runnable immersiveRehideRunnableV242 = null;
    private static boolean isVideoActiveV132 = false;
    private static boolean isVideoAudioOnlyModeV220 = false;
    private static float videoAspectRatioV220 = 16.0f / 9.0f;
    private static boolean isDesktopOverlayActiveV132 = false;
    private static boolean pendingOverlayAfterGrantV147 = false;
    private static boolean waitingForPermScreenV148 = false;
    private static long permFlowLockUntilMsV152 = 0L;
    private static long overlayGrantProtectionUntilMsV153 = 0L;
    private static boolean subSettingsLaunchedV154 = false;
    private static int bringBackTicksV155 = 0;
    private static Runnable bringBackRunnableV155 = null;
    private static int permWatchTicksV147 = 0;
    private static final android.os.Handler permWatchHandlerV147 = new android.os.Handler(android.os.Looper.getMainLooper());
    private static Runnable permWatchRunnableV147 = null;
    private static Runnable storageWatchRunnableV165 = null;
    private static int storageWatchTicksV165 = 0;
    private static Runnable notifWatchRunnableV165 = null;
    private static int notifWatchTicksV165 = 0;
    private static boolean isOpeningSettingsV146 = false;
    private static int savedOverlayW = 0;
    private static int savedOverlayH = 0;
    private static int savedOverlayX = 24;
    private static int savedOverlayY = 140;
    private static android.widget.FrameLayout overlayContainerV132 = null;
    private static android.view.WindowManager wmV132 = null;
    private static android.view.WindowManager.LayoutParams overlayParamsV132 = null;

    private void handleIncomingTorrentIntent(Intent intent) {
        if (intent == null) return;
        try {
            String action = intent.getAction();
            if (Intent.ACTION_VIEW.equals(action)) {
                Uri data = intent.getData();
                if (data != null) {
                    String scheme = data.getScheme();
                    if ("magnet".equalsIgnoreCase(scheme)) {
                        pendingTorrentPayload = data.toString();
                        pendingTorrentName = "Magnet Link";
                    } else {
                        readTorrentUriToPending(data);
                    }
                }
            } else if (Intent.ACTION_SEND.equals(action)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null && sharedText.contains("magnet:?")) {
                    int idx = sharedText.indexOf("magnet:?");
                    String mag = sharedText.substring(idx).trim().split("\\s+")[0];
                    pendingTorrentPayload = mag;
                    pendingTorrentName = "Shared Magnet";
                } else {
                    Uri streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (streamUri != null) {
                        readTorrentUriToPending(streamUri);
                    }
                }
            }
            if (pendingTorrentPayload != null && webView != null) {
                webView.postDelayed(() -> evalJs("if(window.checkAndroidPendingTorrentV114) window.checkAndroidPendingTorrentV114();"), 250);
                webView.postDelayed(() -> evalJs("if(window.checkAndroidPendingTorrentV114) window.checkAndroidPendingTorrentV114();"), 1800);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void readTorrentUriToPending(Uri uri) {
        try {
            String displayName = "external.torrent";
            if ("content".equalsIgnoreCase(uri.getScheme())) {
                try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIdx >= 0) {
                            String n = cursor.getString(nameIdx);
                            if (n != null && !n.isEmpty()) displayName = n;
                        }
                    }
                } catch (Exception ignored) {}
            } else if (uri.getLastPathSegment() != null) {
                displayName = uri.getLastPathSegment();
            }

            try (InputStream is = getContentResolver().openInputStream(uri)) {
                if (is == null) return;
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int nRead;
                while ((nRead = is.read(chunk, 0, chunk.length)) != -1) {
                    buffer.write(chunk, 0, nRead);
                }
                byte[] rawBytes = buffer.toByteArray();
                if (rawBytes.length > 0) {
                    pendingTorrentPayload = "B64TOR:" + Base64.encodeToString(rawBytes, Base64.NO_WRAP);
                    pendingTorrentName = displayName;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    
    // === JENNY_V242_GLOBAL_IMMERSIVE_STICKY ===
    // === BEGIN JENNY_V243_SAFE_INSETS_LOCK ===
    private static final int PLAYER_TOP_OFFSET_PX_V244 = 150;
    private static final int PLAYER_BOTTOM_OFFSET_PX_V244 = 150;
    private boolean insetsListenerAttachedV243 = false;
    private int currentImeBottomPxV244 = 0;

    private String computeSafeAreaInsetsJsonV243() {
        return "{\"top\":0,\"bottom\":0,\"left\":0,\"right\":0,\"overlay\":"
                + isDesktopOverlayActiveV132 + ",\"fullscreen\":" + isVideoFullscreenV132 + "}";
    }

    private void applyPlayerViewportMarginsV244() {
        if (webView == null) return;
        try {
            android.view.Window win = getWindow();
            View decor = (win != null) ? win.getDecorView() : null;
            if (decor != null) {
                decor.setBackgroundColor(0xFF000000);
            }
            android.view.ViewGroup contentGroup = findViewById(android.R.id.content);
            if (contentGroup != null) {
                android.view.View cur = contentGroup;
                while (cur != null) {
                    cur.setBackgroundColor(0xFF000000);
                    if (cur.getPaddingTop() != 0 || cur.getPaddingBottom() != 0
                            || cur.getPaddingLeft() != 0 || cur.getPaddingRight() != 0) {
                        cur.setPadding(0, 0, 0, 0);
                    }
                    if (cur == decor) break;
                    android.view.ViewParent vp = cur.getParent();
                    cur = (vp instanceof android.view.View) ? (android.view.View) vp : null;
                }
            }

            if (isDesktopOverlayActiveV132) {
                android.view.ViewGroup.LayoutParams olp = webView.getLayoutParams();
                if (olp instanceof android.view.ViewGroup.MarginLayoutParams) {
                    android.view.ViewGroup.MarginLayoutParams m = (android.view.ViewGroup.MarginLayoutParams) olp;
                    if (m.topMargin != 0 || m.bottomMargin != 0 || m.leftMargin != 0 || m.rightMargin != 0) {
                        m.topMargin = 0;
                        m.bottomMargin = 0;
                        m.leftMargin = 0;
                        m.rightMargin = 0;
                        webView.setLayoutParams(m);
                    }
                }
                return;
            }

            if (contentGroup != null && webView.getParent() == contentGroup) {
                boolean isLandscape = getResources().getConfiguration().orientation
                        == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
                int wantTop = isLandscape ? 0 : PLAYER_TOP_OFFSET_PX_V244;
                int wantBot = isLandscape
                        ? Math.max(0, currentImeBottomPxV244)
                        : Math.max(PLAYER_BOTTOM_OFFSET_PX_V244, currentImeBottomPxV244);

                android.view.ViewGroup.LayoutParams rawLp = webView.getLayoutParams();
                android.widget.FrameLayout.LayoutParams flp = (rawLp instanceof android.widget.FrameLayout.LayoutParams)
                        ? (android.widget.FrameLayout.LayoutParams) rawLp
                        : new android.widget.FrameLayout.LayoutParams(
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT);

                if (flp.topMargin != wantTop || flp.bottomMargin != wantBot
                        || flp.leftMargin != 0 || flp.rightMargin != 0
                        || flp.width != android.view.ViewGroup.LayoutParams.MATCH_PARENT
                        || flp.height != android.view.ViewGroup.LayoutParams.MATCH_PARENT) {
                    flp.width = android.view.ViewGroup.LayoutParams.MATCH_PARENT;
                    flp.height = android.view.ViewGroup.LayoutParams.MATCH_PARENT;
                    flp.topMargin = wantTop;
                    flp.bottomMargin = wantBot;
                    flp.leftMargin = 0;
                    flp.rightMargin = 0;
                    webView.setLayoutParams(flp);
                    webView.requestLayout();
                }
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyVideoSystemUiLockV132();
    }

    private void applyVideoSystemUiLockV132() {
        runOnUiThread(() -> {
            try {
                android.view.Window win = getWindow();
                if (win == null) return;
                View decor = win.getDecorView();
                boolean keepAwake = isVideoFullscreenV132 || isVideoLockedV132;

                win.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(0xFF000000));
                decor.setBackgroundColor(0xFF000000);
                win.addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
                win.clearFlags(android.view.WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    win.setStatusBarColor(0xFF000000);
                    win.setNavigationBarColor(0xFF000000);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        win.setNavigationBarContrastEnforced(false);
                        win.setStatusBarContrastEnforced(false);
                    } catch (Throwable ignored) {}
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    android.view.WindowManager.LayoutParams lp = win.getAttributes();
                    if (lp.layoutInDisplayCutoutMode != android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES) {
                        lp.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                        win.setAttributes(lp);
                    }
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        win.setDecorFitsSystemWindows(false);
                    } catch (Throwable ignored) {}
                }

                if (webView != null) {
                    webView.setBackgroundColor(0xFF000000);
                }

                if (!insetsListenerAttachedV243 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                    insetsListenerAttachedV243 = true;
                    decor.setOnApplyWindowInsetsListener((v, insets) -> {
                        int imeBot = 0;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            try {
                                imeBot = insets.getInsets(android.view.WindowInsets.Type.ime()).bottom;
                            } catch (Throwable ignored) {}
                        } else {
                            int sysBot = insets.getSystemWindowInsetBottom();
                            if (sysBot > 260) imeBot = sysBot;
                        }
                        if (imeBot != currentImeBottomPxV244) {
                            currentImeBottomPxV244 = imeBot;
                            applyPlayerViewportMarginsV244();
                            if (imeBot == 0) {
                                permWatchHandlerV147.postDelayed(() -> applyVideoSystemUiLockV132(), 120L);
                            }
                        } else {
                            applyPlayerViewportMarginsV244();
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            return android.view.WindowInsets.CONSUMED;
                        }
                        return insets.consumeSystemWindowInsets();
                    });
                }

                if (keepAwake) {
                    win.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    win.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }

                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                decor.setSystemUiVisibility(flags);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        android.view.WindowInsetsController ic = win.getInsetsController();
                        if (ic != null) {
                            ic.hide(android.view.WindowInsets.Type.statusBars()
                                    | android.view.WindowInsets.Type.navigationBars());
                            ic.setSystemBarsBehavior(
                                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        }
                    } catch (Throwable ignored) {}
                }

                applyPlayerViewportMarginsV244();
            } catch (Exception ignored) {}
        });
    }
// === END JENNY_V243_SAFE_INSETS_LOCK ===

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && isDesktopOverlayActiveV132) {
            if (android.os.SystemClock.uptimeMillis() < overlayGrantProtectionUntilMsV153) {
                moveTaskToBack(true);
                return;
            }
            if (isDesktopOverlayActiveV132 && android.os.SystemClock.uptimeMillis() < overlayGrantProtectionUntilMsV153) {
            moveTaskToBack(true);
            return;
        }
        restoreWebViewToActivityV135(false);
        }
        if (hasFocus) {
            applyVideoSystemUiLockV132();
        }
    }

    @Override
    public void onBackPressed() {
        if (isVideoLockedV132) {
            evalJs("if(window.showVideoFeedbackV130) window.showVideoFeedbackV130('🔒 Управление заблокировано');");
            applyVideoSystemUiLockV132();
            return;
        }
        if (isVideoFullscreenV132) {
            evalJs("if(window.toggleVideoNativeFullscreenV132) window.toggleVideoNativeFullscreenV132();");
            return;
        }
        super.onBackPressed();
    }

    
    private void enterDesktopOverlayInternalV133() {
        runOnUiThread(() -> {
            try {
                if (isVideoAudioOnlyModeV220) {
                    return;
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                    return;
                }
                if (isDesktopOverlayActiveV132 || webView == null) return;
                wmV132 = (android.view.WindowManager) getApplicationContext().getSystemService(WINDOW_SERVICE);
                android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
                final float density = dm.density;
                final int screenW = Math.max(720, dm.widthPixels);
                final int screenH = Math.max(1280, dm.heightPixels);
                final int minWinW = Math.round(190 * density);
                final int maxWinW = Math.round(Math.max(screenW, screenH) * 1.45f);

                float aspect = (videoAspectRatioV220 > 0.35f && videoAspectRatioV220 < 3.6f) ? videoAspectRatioV220 : (16.0f / 9.0f);
                int wPx = (savedOverlayW >= minWinW) ? Math.min(maxWinW, savedOverlayW) : Math.round(300 * density);
                int hPx = Math.max(Math.round(105 * density), Math.round(wPx / aspect));
                savedOverlayW = wPx;
                savedOverlayH = hPx;

                int type = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                        ? android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : android.view.WindowManager.LayoutParams.TYPE_PHONE;

                overlayParamsV132 = new android.view.WindowManager.LayoutParams(
                        wPx, hPx, type,
                        android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                | android.view.WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                                | android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                        android.graphics.PixelFormat.TRANSLUCENT
                );
                overlayParamsV132.gravity = android.view.Gravity.TOP | android.view.Gravity.START;
                overlayParamsV132.x = savedOverlayX;
                overlayParamsV132.y = savedOverlayY;

                if (webView.getParent() instanceof android.view.ViewGroup) {
                    ((android.view.ViewGroup) webView.getParent()).removeView(webView);
                }
                webView.setPivotX(0f);
                webView.setPivotY(0f);
                webView.setScaleX(1.0f);
                webView.setScaleY(1.0f);

                overlayContainerV132 = new android.widget.FrameLayout(getApplicationContext()) {
                    private float downRawX = 0f, downRawY = 0f;
                    private int startWinX = 0, startWinY = 0;
                    private boolean isDragging = false;
                    private boolean isPinching = false;
                    private float initSpan = 1f, initFocusX = 0f, initFocusY = 0f;
                    private int pinchStartW = wPx, pinchStartH = hPx, pinchStartX = 0, pinchStartY = 0;
                    private int virtualW = wPx, virtualH = hPx;
                    private long lastLayoutUpdateMs = 0L;

                    private float getRawXSafe(android.view.MotionEvent ev, int idx) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            return ev.getRawX(idx);
                        }
                        return (ev.getRawX() - ev.getX()) + ev.getX(idx);
                    }

                    private float getRawYSafe(android.view.MotionEvent ev, int idx) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            return ev.getRawY(idx);
                        }
                        return (ev.getRawY() - ev.getY()) + ev.getY(idx);
                    }

                    private void cancelWebViewTouch(android.view.MotionEvent ev) {
                        android.view.MotionEvent cancelEv = android.view.MotionEvent.obtain(ev);
                        cancelEv.setAction(android.view.MotionEvent.ACTION_CANCEL);
                        super.dispatchTouchEvent(cancelEv);
                        cancelEv.recycle();
                    }

                    private void applyVirtualSizeAndPos(int targetW, int targetH, int targetX, int targetY, boolean forceSync) {
                        float curAspect = (videoAspectRatioV220 > 0.35f && videoAspectRatioV220 < 3.6f) ? videoAspectRatioV220 : (16.0f / 9.0f);
                        virtualW = Math.max(minWinW, Math.min(maxWinW, targetW));
                        virtualH = Math.max(Math.round(96 * density), Math.round(virtualW / curAspect));

                        // Держим WebView строго 1:1 с окном overlayContainerV132 (scaleX=1.0, scaleY=1.0),
                        // чтобы кнопки управления и крестик ✕ ВСЕГДА находились строго по краям самого окна
                        // без обрезания и без чёрных полос сверху и снизу!
                        if (webView != null) {
                            webView.setPivotX(0f);
                            webView.setPivotY(0f);
                            webView.setScaleX(1.0f);
                            webView.setScaleY(1.0f);
                        }

                        // Оставляем хотя бы 72px окна в пределах экрана, чтобы окно всегда можно было ухватить пальцем и передвинуть
                        int minVisiblePx = Math.round(72 * density);
                        int clampedX = Math.max(minVisiblePx - virtualW, Math.min(screenW - minVisiblePx, targetX));
                        int clampedY = Math.max(0, Math.min(screenH - minVisiblePx, targetY));

                        overlayParamsV132.x = clampedX;
                        overlayParamsV132.y = clampedY;
                        savedOverlayX = clampedX;
                        savedOverlayY = clampedY;

                        long now = android.os.SystemClock.uptimeMillis();
                        boolean sizeChanged = (Math.abs(virtualW - overlayParamsV132.width) >= 2) || (Math.abs(virtualH - overlayParamsV132.height) >= 2);
                        if (forceSync || !sizeChanged || (now - lastLayoutUpdateMs >= 16L)) {
                            overlayParamsV132.width = virtualW;
                            overlayParamsV132.height = virtualH;
                            savedOverlayW = virtualW;
                            savedOverlayH = virtualH;
                            if (sizeChanged) lastLayoutUpdateMs = now;
                            try {
                                wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                            } catch (Exception ignored) {}
                        }
                    }

                    @Override
                    public boolean dispatchTouchEvent(android.view.MotionEvent ev) {
                        if (!isDesktopOverlayActiveV132 || wmV132 == null || overlayParamsV132 == null) {
                            return super.dispatchTouchEvent(ev);
                        }
                        int action = ev.getActionMasked();

                        if (action == android.view.MotionEvent.ACTION_DOWN) {
                            downRawX = getRawXSafe(ev, 0);
                            downRawY = getRawYSafe(ev, 0);
                            startWinX = overlayParamsV132.x;
                            startWinY = overlayParamsV132.y;
                            virtualW = Math.max(minWinW, overlayParamsV132.width);
                            virtualH = Math.max(Math.round(96 * density), overlayParamsV132.height);
                            isDragging = false;
                            isPinching = false;
                            return super.dispatchTouchEvent(ev);
                        }

                        if (action == android.view.MotionEvent.ACTION_POINTER_DOWN && ev.getPointerCount() >= 2) {
                            if (!isPinching) {
                                cancelWebViewTouch(ev);
                            }
                            isPinching = true;
                            isDragging = false;
                            float rx0 = getRawXSafe(ev, 0);
                            float ry0 = getRawYSafe(ev, 0);
                            float rx1 = getRawXSafe(ev, 1);
                            float ry1 = getRawYSafe(ev, 1);
                            initSpan = (float) Math.max(12.0, Math.hypot(rx1 - rx0, ry1 - ry0));
                            initFocusX = (rx0 + rx1) * 0.5f;
                            initFocusY = (ry0 + ry1) * 0.5f;
                            float curAspect = (videoAspectRatioV220 > 0.35f && videoAspectRatioV220 < 3.6f) ? videoAspectRatioV220 : (16.0f / 9.0f);
                            pinchStartW = Math.max(minWinW, overlayParamsV132.width);
                            pinchStartH = Math.max(Math.round(96 * density), Math.round(pinchStartW / curAspect));
                            pinchStartX = overlayParamsV132.x;
                            pinchStartY = overlayParamsV132.y;
                            return true;
                        }

                        if (action == android.view.MotionEvent.ACTION_MOVE) {
                            if (isPinching && ev.getPointerCount() >= 2) {
                                float rx0 = getRawXSafe(ev, 0);
                                float ry0 = getRawYSafe(ev, 0);
                                float rx1 = getRawXSafe(ev, 1);
                                float ry1 = getRawYSafe(ev, 1);
                                float curSpan = (float) Math.max(12.0, Math.hypot(rx1 - rx0, ry1 - ry0));
                                float curFocusX = (rx0 + rx1) * 0.5f;
                                float curFocusY = (ry0 + ry1) * 0.5f;
                                float scale = curSpan / initSpan;

                                float curAspect = (videoAspectRatioV220 > 0.35f && videoAspectRatioV220 < 3.6f) ? videoAspectRatioV220 : (16.0f / 9.0f);
                                int newW = Math.max(minWinW, Math.min(maxWinW, Math.round(pinchStartW * scale)));
                                int newH = Math.max(Math.round(96 * density), Math.round(newW / curAspect));
                                float actualScale = (float) newW / Math.max(1, pinchStartW);

                                int newX = Math.round(curFocusX - (initFocusX - pinchStartX) * actualScale);
                                int newY = Math.round(curFocusY - (initFocusY - pinchStartY) * actualScale);
                                applyVirtualSizeAndPos(newW, newH, newX, newY, false);
                                return true;
                            } else if (!isPinching && ev.getPointerCount() == 1) {
                                float dx = getRawXSafe(ev, 0) - downRawX;
                                float dy = getRawYSafe(ev, 0) - downRawY;
                                if (!isDragging && Math.hypot(dx, dy) > 8.0) {
                                    isDragging = true;
                                    cancelWebViewTouch(ev);
                                }
                                if (isDragging) {
                                    int targetX = Math.round(startWinX + dx);
                                    int targetY = Math.round(startWinY + dy);
                                    applyVirtualSizeAndPos(overlayParamsV132.width, overlayParamsV132.height, targetX, targetY, true);
                                    return true;
                                }
                            }
                            return super.dispatchTouchEvent(ev);
                        }

                        if (action == android.view.MotionEvent.ACTION_POINTER_UP) {
                            if (ev.getPointerCount() <= 2) {
                                int remIdx = (ev.getActionIndex() == 0) ? 1 : 0;
                                downRawX = getRawXSafe(ev, remIdx);
                                downRawY = getRawYSafe(ev, remIdx);
                                startWinX = overlayParamsV132.x;
                                startWinY = overlayParamsV132.y;
                                applyVirtualSizeAndPos(virtualW, virtualH, startWinX, startWinY, true);
                                isPinching = false;
                                isDragging = true;
                            }
                            return true;
                        }

                        if (action == android.view.MotionEvent.ACTION_UP || action == android.view.MotionEvent.ACTION_CANCEL) {
                            if (isDragging || isPinching) {
                                applyVirtualSizeAndPos(virtualW, virtualH, overlayParamsV132.x, overlayParamsV132.y, true);
                                isDragging = false;
                                isPinching = false;
                                return true;
                            }
                        }
                        return super.dispatchTouchEvent(ev);
                    }
                };

                overlayContainerV132.setBackgroundColor(0xFF000000);
                overlayContainerV132.addView(webView, new android.widget.FrameLayout.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                ));
                wmV132.addView(overlayContainerV132, overlayParamsV132);
                isDesktopOverlayActiveV132 = true;
                evalJs("if(window.onDesktopOverlayStateChangedV133) window.onDesktopOverlayStateChangedV133(true);");
            } catch (Exception e) {
                e.printStackTrace();
                restoreWebViewToActivityV135(false);
            }
        });
    }

    private void stopBringBackLoopV155() {
        if (bringBackRunnableV155 != null) {
            permWatchHandlerV147.removeCallbacks(bringBackRunnableV155);
            bringBackRunnableV155 = null;
        }
    }

    private void stopOverlayPermWatcherV147() {
        stopBringBackLoopV155();
        if (permWatchRunnableV147 != null) {
            permWatchHandlerV147.removeCallbacks(permWatchRunnableV147);
            permWatchRunnableV147 = null;
        }
    }

    private void bringMainActivityToFrontV149() {
        if (subSettingsLaunchedV154 || !waitingForPermScreenV148) {
            stopBringBackLoopV155();
            return;
        }
        try {
            android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(android.content.Context.ACTIVITY_SERVICE);
            if (am != null) {
                am.moveTaskToFront(getTaskId(), android.app.ActivityManager.MOVE_TASK_WITH_HOME);
            }
        } catch (Exception ignored) {}
        try {
            Intent i = new Intent(getApplicationContext(), MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
                getApplicationContext(), 149, i,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            if (Build.VERSION.SDK_INT >= 34) {
                android.app.ActivityOptions opts = android.app.ActivityOptions.makeBasic();
                try {
                    android.app.ActivityOptions.class
                        .getMethod("setPendingIntentBackgroundActivityStartMode", int.class)
                        .invoke(opts, 1);
                } catch (Throwable ignored) {}
                pi.send(getApplicationContext(), 0, null, null, null, null, opts.toBundle());
            } else {
                pi.send();
            }
        } catch (Exception ignored) {}
        try {
            Intent i2 = new Intent(getApplicationContext(), MainActivity.class);
            i2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            getApplicationContext().startActivity(i2);
        } catch (Exception ignored) {}
    }

    
    private void ensurePermanentForegroundServiceV212() {
        try {
            Intent svc = new Intent(MainActivity.this, PlaybackService.class);
            svc.setAction(PlaybackService.ACTION_UPDATE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Throwable ignored) {}
    }

    private boolean isIgnoringBatteryOptimizationsInternalV212() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null) {
                    return pm.isIgnoringBatteryOptimizations(getPackageName());
                }
            } catch (Throwable ignored) {}
        }
        return true;
    }

    private boolean hasStoragePermissionInternalV165() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotificationPermissionInternalV165() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    return nm.areNotificationsEnabled();
                }
            } catch (Exception ignored) {}
        }
        return true;
    }

    private void stopStorageGrantRadarV165() {
        if (storageWatchRunnableV165 != null) {
            permWatchHandlerV147.removeCallbacks(storageWatchRunnableV165);
            storageWatchRunnableV165 = null;
        }
    }

    private void startStorageGrantRadarV165() {
        stopStorageGrantRadarV165();
        storageWatchTicksV165 = 0;
        storageWatchRunnableV165 = new Runnable() {
            @Override
            public void run() {
                storageWatchTicksV165++;
                if (hasStoragePermissionInternalV165()) {
                    stopStorageGrantRadarV165();
                    isOpeningSettingsV146 = false;
                    try {
                        finishActivity(REQ_PERM_STORAGE);
                    } catch (Exception ignored) {}
                    evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('storage', true); if(window.fetchData) window.fetchData();");
                    return;
                }
                if (storageWatchTicksV165 < 500) {
                    permWatchHandlerV147.postDelayed(this, 140);
                } else {
                    isOpeningSettingsV146 = false;
                }
            }
        };
        permWatchHandlerV147.postDelayed(storageWatchRunnableV165, 140);
    }

    private void stopNotifGrantRadarV165() {
        if (notifWatchRunnableV165 != null) {
            permWatchHandlerV147.removeCallbacks(notifWatchRunnableV165);
            notifWatchRunnableV165 = null;
        }
    }

    private void startNotifGrantRadarV165() {
        stopNotifGrantRadarV165();
        notifWatchTicksV165 = 0;
        notifWatchRunnableV165 = new Runnable() {
            @Override
            public void run() {
                notifWatchTicksV165++;
                if (hasNotificationPermissionInternalV165()) {
                    stopNotifGrantRadarV165();
                    isOpeningSettingsV146 = false;
                    try {
                        finishActivity(REQ_PERM_NOTIF);
                    } catch (Exception ignored) {}
                    evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('notif', true);");
                    return;
                }
                if (notifWatchTicksV165 < 400) {
                    permWatchHandlerV147.postDelayed(this, 150);
                } else {
                    isOpeningSettingsV146 = false;
                }
            }
        };
        permWatchHandlerV147.postDelayed(notifWatchRunnableV165, 150);
    }

    private void startOverlayGrantRadarV149() {
        stopOverlayPermWatcherV147();
        permWatchTicksV147 = 0;
        permWatchRunnableV147 = new Runnable() {
            @Override
            public void run() {
                permWatchTicksV147++;
                boolean granted = (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) || Settings.canDrawOverlays(MainActivity.this);
                if (granted) {
                    stopOverlayPermWatcherV147();
                    isOpeningSettingsV146 = false;
                    waitingForPermScreenV148 = false;
                    permFlowLockUntilMsV152 = 0L;

                    boolean shouldGoToDesktopOverlay = pendingOverlayAfterGrantV147 && isVideoActiveV132 && !isVideoAudioOnlyModeV220;
                    pendingOverlayAfterGrantV147 = false;

                    try {
                        finishActivity(REQ_OVERLAY_PERM);
                    } catch (Exception ignored) {}

                    if (shouldGoToDesktopOverlay) {
                        // Защищаем созданный оверлей на 3 секунды, пока закрывается окно SubSettings
                        overlayGrantProtectionUntilMsV153 = android.os.SystemClock.uptimeMillis() + 3000L;
                        enterDesktopOverlayInternalV133();
                        evalJs("if(window.ensureVideoPlayingInOverlayV147) window.ensureVideoPlayingInOverlayV147();");
                        try {
                            moveTaskToBack(true);
                        } catch (Exception ignored) {}
                        try {
                            Intent home = new Intent(Intent.ACTION_MAIN);
                            home.addCategory(Intent.CATEGORY_HOME);
                            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(home);
                        } catch (Exception ignored) {}
                    } else {
                        // Запрос был открыт сразу при старте видео или со стартового гида — закрываем SubSettings и уведомляем UI!
                        evalJs("if(window.onReturnedFromPermissionScreenV146) window.onReturnedFromPermissionScreenV146(true); if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('overlay', true);");
                    }
                    return;
                }
                if (permWatchTicksV147 < 500) {
                    permWatchHandlerV147.postDelayed(this, 120);
                } else {
                    isOpeningSettingsV146 = false;
                    waitingForPermScreenV148 = false;
                }
            }
        };
        permWatchHandlerV147.postDelayed(permWatchRunnableV147, 140);
    }

    private Intent attachAutoScrollAndSelfCloseFlagsV151(Intent intent, String pkg) {
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        int appUid = getApplicationInfo().uid;

        Bundle showArgs = new Bundle();
        showArgs.putString("package", pkg);
        showArgs.putInt("uid", appUid);
        showArgs.putString(":settings:show_fragment_title", "Поверх других приложений");
        showArgs.putInt(":android:show_fragment_title", -1);
        showArgs.putString(":settings:fragment_args_key", pkg);
        Intent innerIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + pkg));
        showArgs.putParcelable("intent", innerIntent);

        intent.putExtra(":settings:show_fragment", "com.android.settings.applications.appinfo.DrawOverlayDetails");
        intent.putExtra(":settings:show_fragment_args", showArgs);
        intent.putExtra(":settings:show_fragment_title", "Поверх других приложений");
        intent.putExtra(":android:show_fragment_title", -1);
        intent.putExtra(":settings:fragment_args_key", pkg);
        intent.putExtra("package", pkg);
        intent.putExtra("uid", appUid);
        return intent;
    }

    private void openMiuiOrSystemOverlayWindowV148() {
        try {
            String pkg = getPackageName();
            Uri pkgUri = Uri.parse("package:" + pkg);
            boolean launched = false;

            // Шаг 1 (Проверено через Shizuku): Прямой запуск одиночного тумблера DrawOverlayDetails через SubSettings
            // ВАЖНО: запускается строго через startActivityForResult БЕЗ FLAG_ACTIVITY_NEW_TASK, чтобы SubSettings видел callingPackage!
            try {
                Intent subDirect = new Intent(Intent.ACTION_MAIN);
                subDirect.setClassName("com.android.settings", "com.android.settings.SubSettings");
                subDirect.setData(pkgUri);
                attachAutoScrollAndSelfCloseFlagsV151(subDirect, pkg);
                startActivityForResult(subDirect, REQ_OVERLAY_PERM);
                launched = true;
            } catch (Exception ignored) {}

            // Шаг 2: Фоллбэк на стандартный список, если SubSettings недоступен
            if (!launched && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                try {
                    Intent stdList = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkgUri);
                    attachAutoScrollAndSelfCloseFlagsV151(stdList, pkg);
                    startActivityForResult(stdList, REQ_OVERLAY_PERM);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void launchOverlayPermissionWithAutoWatchV147(final boolean fromHomeButton) {
        runOnUiThread(() -> {
            try {
                long now = android.os.SystemClock.uptimeMillis();
                if (now < permFlowLockUntilMsV152) {
                    return;
                }
                permFlowLockUntilMsV152 = now + 5000L;
                isOpeningSettingsV146 = true;
                pendingOverlayAfterGrantV147 = fromHomeButton;
                subSettingsLaunchedV154 = false;
                evalJs("if(window.saveLiveWorkspaceSnapshotV146) window.saveLiveWorkspaceSnapshotV146(true);");

                try {
                    android.view.Window win = getWindow();
                    if (win != null) {
                        win.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                        win.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                    }
                } catch (Exception ignored) {}

                android.widget.Toast.makeText(
                    getApplicationContext(),
                    "🔓 Включи тумблер «Поверх других приложений»",
                    android.widget.Toast.LENGTH_SHORT
                ).show();

                if (fromHomeButton) {
                    waitingForPermScreenV148 = true;
                    stopBringBackLoopV155();
                    bringBackTicksV155 = 0;
                    bringBackRunnableV155 = new Runnable() {
                        @Override
                        public void run() {
                            if (!waitingForPermScreenV148 || subSettingsLaunchedV154 || Settings.canDrawOverlays(MainActivity.this)) {
                                stopBringBackLoopV155();
                                return;
                            }
                            bringBackTicksV155++;
                            bringMainActivityToFrontV149();
                            if (bringBackTicksV155 < 28 && waitingForPermScreenV148 && !subSettingsLaunchedV154) {
                                permWatchHandlerV147.postDelayed(this, 180);
                            }
                        }
                    };
                    permWatchHandlerV147.postDelayed(bringBackRunnableV155, 180);
                } else {
                    waitingForPermScreenV148 = false;
                    subSettingsLaunchedV154 = true;
                    startOverlayGrantRadarV149();
                    openMiuiOrSystemOverlayWindowV148();
                }
            } catch (Exception e) {
                isOpeningSettingsV146 = false;
                pendingOverlayAfterGrantV147 = false;
                waitingForPermScreenV148 = false;
                subSettingsLaunchedV154 = false;
                permFlowLockUntilMsV152 = 0L;
                e.printStackTrace();
            }
        });
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isOpeningSettingsV146 || waitingForPermScreenV148 || android.os.SystemClock.uptimeMillis() < permFlowLockUntilMsV152) {
            return;
        }
        if (isVideoActiveV132 && !isVideoAudioOnlyModeV220 && !isDesktopOverlayActiveV132) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                launchOverlayPermissionWithAutoWatchV147(true);
            } else {
                enterDesktopOverlayInternalV133();
                evalJs("if(window.ensureVideoPlayingInOverlayV147) window.ensureVideoPlayingInOverlayV147();");
            }
        }
    }

    
    private void restoreWebViewToActivityV135(final boolean bringToFront) {
        runOnUiThread(() -> {
            try {
                boolean wasOverlay = isDesktopOverlayActiveV132;
                isDesktopOverlayActiveV132 = false;
                if (!wasOverlay && overlayContainerV132 == null) {
                    if (webView != null) {
                        webView.onResume();
                        webView.resumeTimers();
                    }
                    return;
                }
                if (overlayContainerV132 != null) {
                    overlayContainerV132.removeAllViews();
                    if (wmV132 != null) {
                        try {
                            wmV132.removeViewImmediate(overlayContainerV132);
                        } catch (Exception e1) {
                            try { wmV132.removeView(overlayContainerV132); } catch (Exception ignored) {}
                        }
                    }
                    overlayContainerV132 = null;
                }
                if (webView != null) {
                    webView.setScaleX(1.0f);
                    webView.setScaleY(1.0f);
                    android.view.ViewGroup contentGroup = findViewById(android.R.id.content);
                    android.view.ViewParent parent = webView.getParent();
                    if (parent != contentGroup) {
                        if (parent instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) parent).removeView(webView);
                        }
                        setContentView(webView);
                    }
                    webView.onResume();
                    webView.resumeTimers();
                    webView.requestLayout();
                    webView.invalidate();
                }
                applyVideoSystemUiLockV132();
                if (bringToFront) {
                    Intent i = new Intent(MainActivity.this, MainActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(i);
                }
                if (wasOverlay) {
                    evalJs("if(window.onDesktopOverlayStateChangedV133) window.onDesktopOverlayStateChangedV133(false);");
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    public static void evalJs(final String script) {
        if (instance != null && instance.webView != null) {
            instance.webView.post(() -> instance.webView.evaluateJavascript(script, null));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // V166_120HZ_UNLOCK: Разблокировка 120 Гц для видеодеки
        try {
            if (android.os.Build.VERSION.SDK_INT >= 23) {
                android.view.Display display = getWindowManager().getDefaultDisplay();
                android.view.Display.Mode[] modes = display.getSupportedModes();
                android.view.Display.Mode bestMode = null;
                float maxHz = 60.0f;
                for (android.view.Display.Mode m : modes) {
                    if (m.getRefreshRate() > maxHz) {
                        maxHz = m.getRefreshRate();
                        bestMode = m;
                    }
                }
                android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
                if (bestMode != null) {
                    lp.preferredDisplayModeId = bestMode.getModeId();
                }
                lp.preferredRefreshRate = 120.0f;
                getWindow().setAttributes(lp);
            }
        } catch (Throwable ignored) {}
        instance = this;

        handleIncomingTorrentIntent(getIntent());

        // 1. Сразу регистрируем канал уведомлений при старте!
        // Это мгновенно разблокирует серый тумблер в настройках Android 13-16
        PlaybackService.ensureChannel(this);
        permWatchHandlerV147.postDelayed(() -> ensurePermanentForegroundServiceV212(), 1200);

        // 2. Разрешения запрашиваются дружелюбно со стартового экрана (Onboarding V165),
        // чтобы не пугать пользователя системными окнами до загрузки интерфейса.

        if (webView != null) {
            if (webView.getParent() instanceof android.view.ViewGroup) {
                ((android.view.ViewGroup) webView.getParent()).removeView(webView);
            }
            webView.setScaleX(1.0f);
                        webView.setScaleY(1.0f);
                        setContentView(webView);
            applyVideoSystemUiLockV132();
            evalJs("if(window.syncAndroidNotification) window.syncAndroidNotification(true);");
            evalJs("if(window.checkAndroidPendingTorrentV114) window.checkAndroidPendingTorrentV114();");
            return;
        }
        webView = new WebView(getApplicationContext()) {
            @Override
            public void onWindowVisibilityChanged(int visibility) {
                super.onWindowVisibilityChanged(View.VISIBLE);
            }
        };
        webView.setScaleX(1.0f);
                        webView.setScaleY(1.0f);
                        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        webView.setWebViewClient(new JennyDirectMediaWebViewClientV238());
        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        applyVideoSystemUiLockV132();
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0 || (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                if (isVideoLockedV132) {
                    applyVideoSystemUiLockV132();
                } else {
                    if (immersiveRehideRunnableV242 != null) {
                        permWatchHandlerV147.removeCallbacks(immersiveRehideRunnableV242);
                    }
                    immersiveRehideRunnableV242 = () -> applyVideoSystemUiLockV132();
                    permWatchHandlerV147.postDelayed(immersiveRehideRunnableV242, 2800L);
                }
            }
        });

        setupFFmpeg();
        checkPermissionsAndStart();
    }

    public class WebAppInterface {
        // === BEGIN JENNY_V238_JNI_BRIDGE_METHODS ===
        @JavascriptInterface
        public String getFoldersFastJson() {
            return buildFastFoldersJsonV238();
        }

        @JavascriptInterface
        public String getDirectEngineStatsJson() {
            try {
                JSONObject o = new JSONObject();
                o.put("status", "ok");
                o.put("direct_hits", directMediaHitsV238.get());
                o.put("jni_folders", true);
                return o.toString();
            } catch (Exception e) {
                return "{\"status\":\"ok\",\"direct_hits\":0,\"jni_folders\":true}";
            }
        }

        @JavascriptInterface
        public void invalidatePresetFolderCache() {
            cachedPresetMtimeV238 = -1L;
        }
        // === END JENNY_V238_JNI_BRIDGE_METHODS ===

                @android.webkit.JavascriptInterface
        public String getSafeAreaInsetsJson() {
            return computeSafeAreaInsetsJsonV243();
        }

        @JavascriptInterface
        public void setVideoFullscreenLock(boolean fullscreen, boolean locked) {
            isVideoFullscreenV132 = fullscreen;
            isVideoLockedV132 = locked;
            applyVideoSystemUiLockV132();
        }

        @JavascriptInterface
        public boolean hasStoragePermission() {
            return hasStoragePermissionInternalV165();
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            runOnUiThread(() -> {
                try {
                    if (hasStoragePermissionInternalV165()) {
                        evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('storage', true);");
                        return;
                    }
                    isOpeningSettingsV146 = true;
                    startStorageGrantRadarV165();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        try {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                            intent.setData(Uri.fromParts("package", getPackageName(), null));
                            startActivityForResult(intent, REQ_PERM_STORAGE);
                        } catch (Exception e1) {
                            Intent intent2 = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                            startActivityForResult(intent2, REQ_PERM_STORAGE);
                        }
                    } else {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE},
                            REQ_PERM_STORAGE
                        );
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public boolean hasNotificationPermission() {
            return hasNotificationPermissionInternalV165();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                try {
                    PlaybackService.ensureChannel(MainActivity.this);
                    if (hasNotificationPermissionInternalV165()) {
                        evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('notif', true);");
                        return;
                    }
                    startNotifGrantRadarV165();
                    if (Build.VERSION.SDK_INT >= 33) {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{"android.permission.POST_NOTIFICATIONS"},
                            REQ_PERM_NOTIF
                        );
                    } else {
                        isOpeningSettingsV146 = true;
                        Intent intent = new Intent();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        } else {
                            intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            intent.setData(Uri.fromParts("package", getPackageName(), null));
                        }
                        startActivityForResult(intent, REQ_PERM_NOTIF);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public boolean canDrawOverlays() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(MainActivity.this);
            }
            return true;
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            launchOverlayPermissionWithAutoWatchV147(false);
        }

        
        private void lockDisplay120HzModeV206(final boolean want120Hz) {
            runOnUiThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        android.view.Display display = getWindowManager().getDefaultDisplay();
                        android.view.Display.Mode[] modes = display.getSupportedModes();
                        android.view.Display.Mode curMode = display.getMode();
                        android.view.Display.Mode bestMode = curMode;
                        float bestRate = want120Hz ? 0.0f : 999.0f;
                        for (android.view.Display.Mode m : modes) {
                            if (m.getPhysicalWidth() == curMode.getPhysicalWidth() &&
                                m.getPhysicalHeight() == curMode.getPhysicalHeight()) {
                                if (want120Hz && m.getRefreshRate() > bestRate) {
                                    bestRate = m.getRefreshRate();
                                    bestMode = m;
                                }
                            }
                        }
                        if (want120Hz && bestMode != null) {
                            android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
                            if (lp.preferredDisplayModeId != bestMode.getModeId()) {
                                lp.preferredDisplayModeId = bestMode.getModeId();
                                getWindow().setAttributes(lp);
                            }
                        }
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void setVideoAspectRatio(float ratio) {
            if (ratio > 0.35f && ratio < 3.6f) {
                videoAspectRatioV220 = ratio;
                runOnUiThread(() -> {
                    try {
                        if (isDesktopOverlayActiveV132 && wmV132 != null && overlayContainerV132 != null && overlayParamsV132 != null) {
                            int curW = Math.max(200, overlayParamsV132.width);
                            int newH = Math.max(110, Math.round(curW / videoAspectRatioV220));
                            if (Math.abs(newH - overlayParamsV132.height) >= 3) {
                                overlayParamsV132.height = newH;
                                savedOverlayH = newH;
                                wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                            }
                        }
                    } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public void setVideoAudioOnlyMode(boolean audioOnly) {
            isVideoAudioOnlyModeV220 = audioOnly;
            if (audioOnly && isDesktopOverlayActiveV132) {
                restoreWebViewToActivityV135(false);
            }
        }

        @JavascriptInterface
        public void setVideoActiveState(boolean active) {
            lockDisplay120HzModeV206(active);
            isVideoActiveV132 = active;
            if (active && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                // Открываем одиночное окно разрешения СРАЗУ при старте видео, пока MainActivity в фокусе на переднем плане!
                // Тогда не нужно свайпать Домой и лишний раз перезаходить в плеер: включил тумблер -> окно само закрылось -> видео играет!
                launchOverlayPermissionWithAutoWatchV147(false);
            }
        }

        @JavascriptInterface
        public void enterDesktopOverlay(final int wDp, final int hDp) {
            enterDesktopOverlayInternalV133();
            runOnUiThread(() -> moveTaskToBack(true));
        }

        @JavascriptInterface
        public void moveDesktopOverlay(final int dxPx, final int dyPx) {
            runOnUiThread(() -> {
                try {
                    if (!isDesktopOverlayActiveV132 || wmV132 == null || overlayContainerV132 == null || overlayParamsV132 == null) return;
                    overlayParamsV132.x += dxPx;
                    overlayParamsV132.y += dyPx;
                    wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void resizeDesktopOverlay(final int wPx, final int hPx) {
            runOnUiThread(() -> {
                try {
                    if (!isDesktopOverlayActiveV132 || wmV132 == null || overlayContainerV132 == null || overlayParamsV132 == null) return;
                    overlayParamsV132.width = Math.max(220, Math.min(1400, wPx));
                    overlayParamsV132.height = Math.max(135, Math.min(1800, hPx));
                    wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void exitDesktopOverlay(final boolean bringToFront) {
            restoreWebViewToActivityV135(bringToFront);
        }

        @JavascriptInterface
        public String consumePendingTorrent() {
            try {
                if (pendingTorrentPayload == null || pendingTorrentPayload.isEmpty()) {
                    return "";
                }
                JSONObject obj = new JSONObject();
                obj.put("payload", pendingTorrentPayload);
                obj.put("name", pendingTorrentName != null ? pendingTorrentName : "file.torrent");
                pendingTorrentPayload = null;
                pendingTorrentName = null;
                return obj.toString();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void pickTorrentFile() {
            runOnUiThread(() -> {
                try {
                    isOpeningSettingsV146 = true;
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivityForResult(intent, REQ_PICK_TORRENT);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public void pickFolder() {
            runOnUiThread(() -> {
                try {
                    isOpeningSettingsV146 = true;
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    startActivityForResult(intent, REQ_PICK_FOLDER);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

                @JavascriptInterface
        public boolean isIgnoringBatteryOptimizations() {
            return isIgnoringBatteryOptimizationsInternalV212();
        }

        @JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            runOnUiThread(() -> {
                try {
                    ensurePermanentForegroundServiceV212();
                    if (isIgnoringBatteryOptimizationsInternalV212()) {
                        evalJs("if(window.onBatteryOptUpdatedV212) window.onBatteryOptUpdatedV212(true);");
                        return;
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        isOpeningSettingsV146 = true;
                        try {
                            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        } catch (Exception e1) {
                            Intent intent2 = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                            startActivity(intent2);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        

        

        // === JENNY_V237_DATASYNC_BRIDGE_START ===
        @JavascriptInterface
        public void updateDataSyncState(boolean active, String title, String status, int progressPct) {
            try {
                Intent svc = new Intent(MainActivity.this, PlaybackService.class);
                svc.setAction(PlaybackService.ACTION_UPDATE_DATASYNC);
                svc.putExtra("dl_active", active);
                svc.putExtra("dl_title", title != null ? title : "");
                svc.putExtra("dl_status", status != null ? status : "");
                svc.putExtra("dl_pct", progressPct);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void setNotificationLockState(boolean locked) {
            try {
                Intent svc = new Intent(MainActivity.this, PlaybackService.class);
                svc.setAction(PlaybackService.ACTION_UPDATE_DATASYNC);
                svc.putExtra("notif_locked", locked);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            } catch (Throwable ignored) {}
        }
        // === JENNY_V237_DATASYNC_BRIDGE_END ===

        @JavascriptInterface
        public void updateMediaStateFull(String title, String subtitle, boolean isPlaying, double posSec, double durSec, double speed) {
            Intent svc = new Intent(MainActivity.this, PlaybackService.class);
            svc.setAction(PlaybackService.ACTION_UPDATE);
            svc.putExtra("title", title);
            svc.putExtra("subtitle", subtitle);
            svc.putExtra("playing", isPlaying);
            svc.putExtra("pos", (long) (posSec * 1000));
            svc.putExtra("dur", (long) (durSec * 1000));
            svc.putExtra("speed", (float) speed);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        }

        @JavascriptInterface
        public void updateMediaState(String title, boolean isPlaying, double posSec, double durSec, double speed) {
            Intent svc = new Intent(MainActivity.this, PlaybackService.class);
            svc.setAction(PlaybackService.ACTION_UPDATE);
            svc.putExtra("title", title);
            svc.putExtra("playing", isPlaying);
            svc.putExtra("pos", (long) (posSec * 1000));
            svc.putExtra("dur", (long) (durSec * 1000));
            svc.putExtra("speed", (float) speed);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_TORRENT && resultCode == Activity.RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) {
                readTorrentUriToPending(uri);
                if (pendingTorrentPayload != null && webView != null) {
                    webView.post(() -> evalJs("if(window.checkAndroidPendingTorrentV114) window.checkAndroidPendingTorrentV114();"));
                }
            }
            return;
        }
        if (requestCode == REQ_PICK_FOLDER && resultCode == Activity.RESULT_OK && data != null) {
            Uri treeUri = data.getData();
            if (treeUri != null) {
                String realPath = resolveTreeUriToPath(treeUri);
                if (realPath != null && !realPath.isEmpty()) {
                    String escaped = realPath.replace("\\", "\\\\").replace("'", "\\'");
                    webView.post(() -> webView.evaluateJavascript(
                        "if(window.onNativeFolderPicked) window.onNativeFolderPicked('" + escaped + "');",
                        null
                    ));
                }
            }
        }
    }

    private String resolveTreeUriToPath(Uri treeUri) {
        try {
            String docId = DocumentsContract.getTreeDocumentId(treeUri);
            if (docId == null) return null;
            if (docId.startsWith("raw:")) {
                return docId.substring(4);
            }
            String[] split = docId.split(":");
            String type = split[0];
            String relPath = split.length > 1 ? split[1] : "";

            if ("primary".equalsIgnoreCase(type)) {
                String base = Environment.getExternalStorageDirectory().getAbsolutePath();
                return relPath.isEmpty() ? base : base + "/" + relPath;
            } else {
                String candidate = "/storage/" + type + (relPath.isEmpty() ? "" : "/" + relPath);
                if (new File(candidate).exists()) {
                    return candidate;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private void setupFFmpeg() {
        try {
            File oldBrokenFile = new File(getFilesDir(), "ffmpeg");
            if (oldBrokenFile.exists() && oldBrokenFile.length() < 1000000) {
                oldBrokenFile.delete();
            }

            String nativeDir = getApplicationInfo().nativeLibraryDir;
            File nativeFFmpeg = new File(nativeDir, "libffmpeg.so");
            if (nativeFFmpeg.exists()) {
                nativeFFmpeg.setExecutable(true);
                Os.setenv("FFMPEG_BINARY", nativeFFmpeg.getAbsolutePath(), true);
            }
            File nativeXflac = new File(nativeDir, "libxflac.so");
            if (nativeXflac.exists()) {
                Os.setenv("XFLAC_LIB_PATH", nativeXflac.getAbsolutePath(), true);
            }
            Os.setenv("JENNY_NATIVE_DIR", nativeDir, true);
            Os.setenv("JENNY_FILES_DIR", getFilesDir().getAbsolutePath(), true);

            String path = System.getenv("PATH");
            Os.setenv("PATH", nativeDir + ":" + getFilesDir().getAbsolutePath() + ":" + path, true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERM_STORAGE) {
            boolean ok = hasStoragePermissionInternalV165();
            evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('storage', " + ok + "); if(window.fetchData) window.fetchData();");
        } else if (requestCode == REQ_PERM_NOTIF) {
            boolean ok = hasNotificationPermissionInternalV165();
            if (ok) {
                stopNotifGrantRadarV165();
                evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('notif', true);");
            } else if (!ActivityCompat.shouldShowRequestPermissionRationale(this, "android.permission.POST_NOTIFICATIONS")) {
                // Если Android заблокировал стандартный диалог — открываем системное окно уведомлений нашего приложения
                try {
                    isOpeningSettingsV146 = true;
                    Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivityForResult(intent, REQ_PERM_NOTIF);
                } catch (Exception ignored) {}
            } else {
                evalJs("if(window.onOnboardingPermUpdatedV165) window.onOnboardingPermUpdatedV165('notif', false);");
            }
        }
    }

    private void checkPermissionsAndStart() {
        // Всегда сразу запускаем сервер и интерфейс, чтобы стартовый гид (Onboarding V165)
        // встретил пользователя в фирменном стиле без резких перебросов в настройки!
        startPythonServer();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingTorrentIntent(intent);
        evalJs("if(window.syncAndroidNotification) window.syncAndroidNotification(true);");
        evalJs("if(window.checkAndroidPendingTorrentV114) window.checkAndroidPendingTorrentV114();");
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyVideoSystemUiLockV132();
        boolean granted = (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) || Settings.canDrawOverlays(this);

        if (waitingForPermScreenV148 && !subSettingsLaunchedV154 && !granted && isVideoActiveV132) {
            waitingForPermScreenV148 = false;
            subSettingsLaunchedV154 = true;
            stopBringBackLoopV155();
            isOpeningSettingsV146 = true;
            pendingOverlayAfterGrantV147 = true;
            permFlowLockUntilMsV152 = android.os.SystemClock.uptimeMillis() + 6000L;
            startOverlayGrantRadarV149();
            openMiuiOrSystemOverlayWindowV148();
            try {
                overridePendingTransition(0, 0);
            } catch (Exception ignored) {}
            return;
        }

        if (isDesktopOverlayActiveV132 && android.os.SystemClock.uptimeMillis() < overlayGrantProtectionUntilMsV153) {
            moveTaskToBack(true);
            return;
        }

        stopOverlayPermWatcherV147();
        boolean wasPermSettings = isOpeningSettingsV146;
        boolean wantAutoOverlay = pendingOverlayAfterGrantV147;
        isOpeningSettingsV146 = false;
        pendingOverlayAfterGrantV147 = false;
        waitingForPermScreenV148 = false;
        subSettingsLaunchedV154 = false;
        permFlowLockUntilMsV152 = 0L;

        if (wasPermSettings && wantAutoOverlay && granted && isVideoActiveV132 && !isVideoAudioOnlyModeV220 && !isDesktopOverlayActiveV132) {
            overlayGrantProtectionUntilMsV153 = android.os.SystemClock.uptimeMillis() + 3000L;
            enterDesktopOverlayInternalV133();
            evalJs("if(window.ensureVideoPlayingInOverlayV147) window.ensureVideoPlayingInOverlayV147();");
            moveTaskToBack(true);
            return;
        }

        stopStorageGrantRadarV165();
        stopNotifGrantRadarV165();
        restoreWebViewToActivityV135(false);
        if (webView != null) {
            webView.postDelayed(() -> {
                if (wasPermSettings) {
                    evalJs("if(window.onReturnedFromPermissionScreenV146) window.onReturnedFromPermissionScreenV146(" + granted + ");");
                }
                evalJs("if(window.syncOnboardingPermsV165) window.syncOnboardingPermsV165();");
                if (isVideoFullscreenV132 || isVideoLockedV132) {
                    applyVideoSystemUiLockV132();
                }
            }, 180);
        }
        startPythonServer();
    }

    private void startPythonServer() {
        if (!Python.isStarted()) {
            Python.start(new AndroidPlatform(this));
            new Thread(() -> {
                try {
                    Python.getInstance().getModule("player").callAttr("start_server");
                } catch (Throwable t) {
                    t.printStackTrace();
                }
            }).start();
            isPageLoaded = true;
            webView.postDelayed(() -> webView.loadUrl("http://127.0.0.1:8080"), 1500);
        } else if (!isPageLoaded) {
            isPageLoaded = true;
            webView.loadUrl("http://127.0.0.1:8080");
        }
    }

    // === BEGIN JENNY_V238_DIRECT_MEDIA_CLIENT ===
    private static String normDirPathV238(String raw) {
        if (raw == null) return "/storage/emulated/0/Music";
        String p = raw.trim();
        if (p.isEmpty()) return "/storage/emulated/0/Music";
        if (!p.startsWith("/")) {
            p = "/storage/emulated/0/" + p;
        }
        while (p.length() > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    private static String readSmallUtf8FileV238(File f) {
        if (f == null || !f.isFile()) return null;
        FileInputStream fis = null;
        try {
            long len = f.length();
            if (len <= 0L || len > 4L * 1024L * 1024L) return null;
            fis = new FileInputStream(f);
            ByteArrayOutputStream bos = new ByteArrayOutputStream((int) Math.min(len, 65536L));
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return new String(bos.toByteArray(), "UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (fis != null) {
                try { fis.close(); } catch (Exception ignored) {}
            }
        }
    }

    // === JENNY_V245_GLOBAL_SCAN_JAVA ===
    private static volatile long lastGlobalDirWalkMsV245 = 0L;

    private static boolean shouldSkipGlobalScanDirV245(String name) {
        if (name == null || name.isEmpty() || name.charAt(0) == '.') return true;
        return "Android".equalsIgnoreCase(name)
                || "JENNY".equalsIgnoreCase(name)
                || "torrents_tmp".equalsIgnoreCase(name)
                || "proc".equalsIgnoreCase(name)
                || "sys".equalsIgnoreCase(name)
                || "LOST.DIR".equalsIgnoreCase(name)
                || "$RECYCLE.BIN".equalsIgnoreCase(name)
                || "Trash".equalsIgnoreCase(name);
    }

    private static void walkStorageDirsV245(File dir, int depth, int maxDepth, LinkedHashSet<String> out, int maxDirs) {
        if (dir == null || depth > maxDepth || out.size() >= maxDirs) return;
        String abs = normDirPathV238(dir.getAbsolutePath());
        if (!abs.isEmpty()) out.add(abs);
        if (depth == maxDepth) return;
        File[] children = null;
        try {
            children = dir.listFiles();
        } catch (Exception ignored) {}
        if (children == null) return;
        for (int i = 0; i < children.length; i++) {
            if (out.size() >= maxDirs) break;
            File ch = children[i];
            if (ch != null && ch.isDirectory()) {
                String nm = ch.getName();
                if (!shouldSkipGlobalScanDirV245(nm)) {
                    walkStorageDirsV245(ch, depth + 1, maxDepth, out, maxDirs);
                }
            }
        }
    }

    private static List<String> getLookupMediaDirsV238() {
        File preset = new File("/storage/emulated/0/Music/jenny_dsp_preset.json");
        long mtime = preset.exists() ? preset.lastModified() : 0L;
        long nowMs = android.os.SystemClock.uptimeMillis();
        List<String> cur = cachedLookupDirsV238;
        if (cur != null && cachedPresetMtimeV238 == mtime && (nowMs - lastGlobalDirWalkMsV245 < 12000L)) {
            return cur;
        }
        synchronized (presetCacheLockV238) {
            if (cachedLookupDirsV238 != null && cachedPresetMtimeV238 == mtime && (nowMs - lastGlobalDirWalkMsV245 < 12000L)) {
                return cachedLookupDirsV238;
            }
            boolean scanAll = true;
            LinkedHashSet<String> dirs = new LinkedHashSet<String>();
            if (preset.isFile()) {
                String txt = readSmallUtf8FileV238(preset);
                if (txt != null && !txt.isEmpty()) {
                    try {
                        JSONObject j = new JSONObject(txt);
                        if (j.has("scanAllFolders")) {
                            scanAll = j.optBoolean("scanAllFolders", true);
                        }
                        JSONArray act = j.optJSONArray("activeFolders");
                        if (act != null) {
                            for (int i = 0; i < act.length(); i++) {
                                String d = normDirPathV238(act.optString(i, ""));
                                if (!d.isEmpty()) dirs.add(d);
                            }
                        }
                        String cDir = j.optString("customMusicDir", "");
                        if (cDir != null && !cDir.trim().isEmpty()) {
                            dirs.add(normDirPathV238(cDir));
                        }
                        JSONArray sav = j.optJSONArray("savedFolders");
                        if (sav != null) {
                            for (int i = 0; i < sav.length(); i++) {
                                String d = normDirPathV238(sav.optString(i, ""));
                                if (!d.isEmpty()) dirs.add(d);
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }
            dirs.add("/storage/emulated/0/Music");
            dirs.add("/storage/emulated/0/JennyVideo");
            dirs.add("/storage/emulated/0/Download");
            dirs.add("/storage/emulated/0/Movies");
            if (scanAll) {
                File extRoot = new File("/storage/emulated/0");
                if (extRoot.isDirectory() && extRoot.canRead()) {
                    walkStorageDirsV245(extRoot, 0, 5, dirs, 600);
                }
            }
            List<String> built = new ArrayList<String>(dirs);
            cachedLookupDirsV238 = built;
            cachedPresetMtimeV238 = mtime;
            lastGlobalDirWalkMsV245 = nowMs;
            return built;
        }
    }

    private static String buildFastFoldersJsonV238() {
        try {
            File preset = new File("/storage/emulated/0/Music/jenny_dsp_preset.json");
            LinkedHashSet<String> savedSet = new LinkedHashSet<String>();
            LinkedHashSet<String> activeSet = new LinkedHashSet<String>();
            LinkedHashSet<String> extSet = new LinkedHashSet<String>();
            String[] baseExts = new String[] {
                ".mp3", ".flac", ".wav", ".ogg", ".opus", ".m4a", ".aac", ".xflac",
                ".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".3gp", ".ts", ".m2ts", ".wmv", ".flv"
            };
            for (int i = 0; i < baseExts.length; i++) {
                extSet.add(baseExts[i]);
            }

            if (preset.isFile()) {
                String txt = readSmallUtf8FileV238(preset);
                if (txt != null && !txt.isEmpty()) {
                    try {
                        JSONObject j = new JSONObject(txt);
                        JSONArray sav = j.optJSONArray("savedFolders");
                        if (sav != null) {
                            for (int i = 0; i < sav.length(); i++) {
                                String d = normDirPathV238(sav.optString(i, ""));
                                if (!d.isEmpty()) savedSet.add(d);
                            }
                        }
                        JSONArray act = j.optJSONArray("activeFolders");
                        if (act != null) {
                            for (int i = 0; i < act.length(); i++) {
                                String d = normDirPathV238(act.optString(i, ""));
                                File df = new File(d);
                                if (df.isDirectory()) {
                                    activeSet.add(d);
                                    savedSet.add(d);
                                }
                            }
                        }
                        if (activeSet.isEmpty()) {
                            String cDir = j.optString("customMusicDir", "");
                            if (cDir != null && !cDir.trim().isEmpty()) {
                                String nd = normDirPathV238(cDir);
                                if (new File(nd).isDirectory()) {
                                    activeSet.add(nd);
                                    savedSet.add(nd);
                                }
                            }
                        }
                        String[] extraKeys = new String[] { "customFormats", "customVideoFormats" };
                        for (int k = 0; k < extraKeys.length; k++) {
                            JSONArray arr = j.optJSONArray(extraKeys[k]);
                            if (arr != null) {
                                for (int i = 0; i < arr.length(); i++) {
                                    String ex = arr.optString(i, "").trim().toLowerCase(Locale.ROOT);
                                    if (!ex.isEmpty()) {
                                        if (!ex.startsWith(".")) ex = "." + ex;
                                        extSet.add(ex);
                                    }
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            if (savedSet.isEmpty()) {
                savedSet.add("/storage/emulated/0/Music");
            }
            if (activeSet.isEmpty()) {
                activeSet.add(savedSet.iterator().next());
            }

            JSONArray savedArr = new JSONArray();
            JSONArray activeArr = new JSONArray();
            JSONObject folderCounts = new JSONObject();

            for (String d : savedSet) {
                savedArr.put(d);
                int count = 0;
                try {
                    File dirFile = new File(d);
                    String[] names = dirFile.list();
                    if (names != null) {
                        for (int i = 0; i < names.length; i++) {
                            String fn = names[i];
                            if (fn == null || fn.isEmpty() || fn.charAt(0) == '.') continue;
                            String low = fn.toLowerCase(Locale.ROOT);
                            if (low.startsWith("temp_")) continue;
                            int dot = low.lastIndexOf('.');
                            if (dot > 0) {
                                String ext = low.substring(dot);
                                if (extSet.contains(ext)) {
                                    count++;
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
                folderCounts.put(d, count);
            }

            String currentFolder = "/storage/emulated/0/Music";
            boolean firstAct = true;
            for (String d : activeSet) {
                if (firstAct) {
                    currentFolder = d;
                    firstAct = false;
                }
                activeArr.put(d);
            }

            JSONObject out = new JSONObject();
            out.put("status", "ok");
            boolean scanAllFlag = true;
            if (preset.isFile()) {
                try {
                    String pTxt = readSmallUtf8FileV238(preset);
                    if (pTxt != null && !pTxt.isEmpty()) {
                        JSONObject pj = new JSONObject(pTxt);
                        if (pj.has("scanAllFolders")) scanAllFlag = pj.optBoolean("scanAllFolders", true);
                    }
                } catch (Exception ignored) {}
            }
            out.put("fast_jni", true);
            out.put("scan_all_folders", scanAllFlag);
            out.put("saved_folders", savedArr);
            out.put("active_folders", activeArr);
            out.put("current_folder", currentFolder);
            out.put("folder_counts", folderCounts);
            return out.toString();
        } catch (Exception e) {
            return "{\"status\":\"error\"}";
        }
    }

    private static boolean hasJennyRevTrailerV238(File f, long len) {
        if (len <= 88L) return false;
        RandomAccessFile raf = null;
        try {
            raf = new RandomAccessFile(f, "r");
            raf.seek(len - 24L);
            byte[] tail = new byte[24];
            raf.readFully(tail);
            if (tail[0] == 'J' && tail[1] == 'R' && tail[2] == 'E' && tail[3] == 'V' &&
                tail[16] == 'J' && tail[17] == 'E' && tail[18] == 'N' && tail[19] == 'N' &&
                tail[20] == 'Y' && tail[21] == 'V' && tail[22] == '6' && tail[23] == '7') {
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        } finally {
            if (raf != null) {
                try { raf.close(); } catch (Exception ignored) {}
            }
        }
    }

    private static boolean hasValidIsoBmffHeaderV240(File f, long len) {
        if (len < 12L) return false;
        RandomAccessFile raf = null;
        try {
            raf = new RandomAccessFile(f, "r");
            byte[] h = new byte[12];
            raf.readFully(h);
            // Reject EBML (Matroska / WebM spoofed as .mp4: 1A 45 DF A3) or RIFF/AVI or OggS
            if ((h[0] & 0xFF) == 0x1A && (h[1] & 0xFF) == 0x45 && (h[2] & 0xFF) == 0xDF && (h[3] & 0xFF) == 0xA3) {
                return false;
            }
            if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F') return false;
            if (h[0] == 'O' && h[1] == 'g' && h[2] == 'g' && h[3] == 'S') return false;
            // Standard ISO BMFF boxes have 'ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'styp' at bytes 4..7
            String box = new String(h, 4, 4, "US-ASCII");
            return "ftyp".equals(box) || "moov".equals(box) || "mdat".equals(box)
                    || "free".equals(box) || "wide".equals(box) || "skip".equals(box) || "styp".equals(box);
        } catch (Exception e) {
            return false;
        } finally {
            if (raf != null) {
                try { raf.close(); } catch (Exception ignored) {}
            }
        }
    }

    private static String guessMediaMimeV238(String lowName) {
        if (lowName.endsWith(".mp3")) return "audio/mpeg";
        if (lowName.endsWith(".flac")) return "audio/flac";
        if (lowName.endsWith(".wav")) return "audio/wav";
        if (lowName.endsWith(".m4a")) return "audio/mp4";
        if (lowName.endsWith(".aac")) return "audio/aac";
        if (lowName.endsWith(".ogg") || lowName.endsWith(".opus")) return "audio/ogg";
        if (lowName.endsWith(".mp4") || lowName.endsWith(".m4v")) return "video/mp4";
        if (lowName.endsWith(".webm")) return "video/webm";
        return null;
    }

    private static Map<String, String> buildCorsMediaHeadersV238(long contentLength, String contentRange, boolean acceptRanges) {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        h.put("Access-Control-Allow-Headers", "Origin, Accept, Content-Type, X-Requested-With, Range, Cache-Control");
        h.put("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Jenny-Direct");
        h.put("Timing-Allow-Origin", "*");
        h.put("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        h.put("X-Jenny-Direct", "java-disk-v238");
        if (acceptRanges) {
            h.put("Accept-Ranges", "bytes");
        }
        if (contentLength >= 0L) {
            h.put("Content-Length", String.valueOf(contentLength));
        }
        if (contentRange != null && !contentRange.isEmpty()) {
            h.put("Content-Range", contentRange);
        }
        return h;
    }

    private static final class BoundedRandomAccessStreamV238 extends InputStream {
        private final RandomAccessFile raf;
        private long remaining;
        private boolean closed = false;

        BoundedRandomAccessStreamV238(File file, long startOffset, long length) throws IOException {
            this.raf = new RandomAccessFile(file, "r");
            if (startOffset > 0L) {
                this.raf.seek(startOffset);
            }
            this.remaining = length;
        }

        @Override
        public int read() throws IOException {
            if (closed || remaining <= 0L) return -1;
            int b = raf.read();
            if (b >= 0) {
                remaining--;
            } else {
                remaining = 0L;
            }
            return b;
        }

        @Override
        public int read(byte[] buffer, int byteOffset, int byteCount) throws IOException {
            if (closed) return -1;
            if (byteCount == 0) return 0;
            if (remaining <= 0L) return -1;
            int toRead = (int) Math.min((long) byteCount, remaining);
            int n = raf.read(buffer, byteOffset, toRead);
            if (n > 0) {
                remaining -= n;
            } else {
                remaining = 0L;
            }
            return n;
        }

        @Override
        public void close() throws IOException {
            if (!closed) {
                closed = true;
                remaining = 0L;
                raf.close();
            }
        }
    }

    private static final class JennyDirectMediaWebViewClientV238 extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request == null) return null;
            Uri uri = request.getUrl();
            if (uri == null) return null;
            String host = uri.getHost();
            if (host == null || (!"127.0.0.1".equals(host) && !"localhost".equalsIgnoreCase(host))) {
                return null;
            }
            String encPath = uri.getEncodedPath();
            if (encPath == null || !encPath.startsWith("/api/media/") || encPath.length() <= 11) {
                return null;
            }
            String method = request.getMethod();
            if ("OPTIONS".equalsIgnoreCase(method)) {
                Map<String, String> optHeaders = buildCorsMediaHeadersV238(0L, null, true);
                return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    204,
                    "No Content",
                    optHeaders,
                    new ByteArrayInputStream(new byte[0])
                );
            }
            if (!"GET".equalsIgnoreCase(method)) {
                return null;
            }

            String rawRel = encPath.substring(11);
            String filename = Uri.decode(rawRel);
            if (filename == null || filename.isEmpty() || filename.contains("..") || filename.indexOf('/') >= 0 || filename.indexOf('\\') >= 0) {
                return null;
            }

            String low = filename.toLowerCase(Locale.ROOT);
            if (low.endsWith(".xflac")) {
                return null;
            }
            String mime = guessMediaMimeV238(low);
            if (mime == null) {
                return null;
            }

            File matched = null;
            List<String> dirs = getLookupMediaDirsV238();
            for (int i = 0; i < dirs.size(); i++) {
                File cand = new File(dirs.get(i), filename);
                if (cand.isFile() && cand.canRead()) {
                    matched = cand;
                    break;
                }
            }
            if (matched == null) {
                return null;
            }

            long totalLen = matched.length();
            if (totalLen <= 0L) {
                return null;
            }

            if ((low.endsWith(".opus") || low.endsWith(".ogg")) && hasJennyRevTrailerV238(matched, totalLen)) {
                return null;
            }
            if ((low.endsWith(".mp4") || low.endsWith(".m4v")) && !hasValidIsoBmffHeaderV240(matched, totalLen)) {
                return null;
            }

            String rangeHeader = null;
            Map<String, String> reqHeaders = request.getRequestHeaders();
            if (reqHeaders != null) {
                rangeHeader = reqHeaders.get("Range");
                if (rangeHeader == null) {
                    for (Map.Entry<String, String> e : reqHeaders.entrySet()) {
                        if (e.getKey() != null && "range".equalsIgnoreCase(e.getKey())) {
                            rangeHeader = e.getValue();
                            break;
                        }
                    }
                }
            }

            try {
                if (rangeHeader != null && rangeHeader.trim().toLowerCase(Locale.ROOT).startsWith("bytes=")) {
                    String spec = rangeHeader.trim().substring(6);
                    int comma = spec.indexOf(',');
                    if (comma >= 0) {
                        spec = spec.substring(0, comma).trim();
                    }
                    int dash = spec.indexOf('-');
                    if (dash >= 0) {
                        String sPart = spec.substring(0, dash).trim();
                        String ePart = spec.substring(dash + 1).trim();
                        long startB;
                        long endB;
                        if (sPart.isEmpty()) {
                            long suffixLen = Long.parseLong(ePart);
                            if (suffixLen <= 0L) suffixLen = 1L;
                            startB = Math.max(0L, totalLen - suffixLen);
                            endB = totalLen - 1L;
                        } else {
                            startB = Long.parseLong(sPart);
                            endB = ePart.isEmpty() ? (totalLen - 1L) : Long.parseLong(ePart);
                            if (endB >= totalLen) endB = totalLen - 1L;
                        }

                        if (startB < 0L || startB >= totalLen || startB > endB) {
                            Map<String, String> errH = buildCorsMediaHeadersV238(0L, "bytes */" + totalLen, true);
                            return new WebResourceResponse(
                                mime,
                                null,
                                416,
                                "Requested Range Not Satisfiable",
                                errH,
                                new ByteArrayInputStream(new byte[0])
                            );
                        }

                        long chunkLen = (endB - startB) + 1L;
                        String cRange = "bytes " + startB + "-" + endB + "/" + totalLen;
                        Map<String, String> partH = buildCorsMediaHeadersV238(chunkLen, cRange, true);
                        BoundedRandomAccessStreamV238 stream = new BoundedRandomAccessStreamV238(matched, startB, chunkLen);
                        directMediaHitsV238.incrementAndGet();
                        return new WebResourceResponse(
                            mime,
                            null,
                            206,
                            "Partial Content",
                            partH,
                            stream
                        );
                    }
                }

                Map<String, String> okH = buildCorsMediaHeadersV238(totalLen, null, true);
                BoundedRandomAccessStreamV238 fullStream = new BoundedRandomAccessStreamV238(matched, 0L, totalLen);
                directMediaHitsV238.incrementAndGet();
                return new WebResourceResponse(
                    mime,
                    null,
                    200,
                    "OK",
                    okH,
                    fullStream
                );
            } catch (Exception e) {
                return null;
            }
        }
    }
    // === END JENNY_V238_DIRECT_MEDIA_CLIENT ===
}
