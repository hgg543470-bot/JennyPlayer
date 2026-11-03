package com.jenny.player;

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

public class MainActivity extends AppCompatActivity {
    private static final int REQ_PERM_STORAGE = 1;
    private static final int REQ_PERM_NOTIF = 2;
    private static final int REQ_PICK_FOLDER = 42;
    private static final int REQ_PICK_TORRENT = 43;
    private static MainActivity instance;
    private static WebView webView;
    private static boolean isPageLoaded = false;
    private static String pendingTorrentPayload = null;
    private static String pendingTorrentName = null;
    private static boolean isVideoFullscreenV132 = false;
    private static boolean isVideoLockedV132 = false;
    private static boolean isVideoActiveV132 = false;
    private static boolean isDesktopOverlayActiveV132 = false;
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

    
    private void applyVideoSystemUiLockV132() {
        runOnUiThread(() -> {
            try {
                android.view.Window win = getWindow();
                if (win == null) return;
                View decor = win.getDecorView();
                boolean hideBars = isVideoFullscreenV132 || isVideoLockedV132;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    android.view.WindowManager.LayoutParams lp = win.getAttributes();
                    lp.layoutInDisplayCutoutMode = hideBars
                        ? android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                        : android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
                    win.setAttributes(lp);
                }

                if (hideBars) {
                    win.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                    decor.setSystemUiVisibility(flags);

                    if (Build.VERSION.SDK_INT >= 29 && webView != null) {
                        int w = Math.max(1080, webView.getWidth());
                        int h = Math.max(2400, webView.getHeight());
                        java.util.List<android.graphics.Rect> rects = new java.util.ArrayList<>();
                        rects.add(new android.graphics.Rect(0, h - 220, w, h));
                        rects.add(new android.graphics.Rect(0, 0, w, 160));
                        rects.add(new android.graphics.Rect(0, h / 2 - 200, 120, h / 2 + 200));
                        rects.add(new android.graphics.Rect(w - 120, h / 2 - 200, w, h / 2 + 200));
                        webView.setSystemGestureExclusionRects(rects);
                    }
                } else {
                    win.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                    if (Build.VERSION.SDK_INT >= 29 && webView != null) {
                        webView.setSystemGestureExclusionRects(java.util.Collections.emptyList());
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && (isVideoFullscreenV132 || isVideoLockedV132)) {
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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                    return;
                }
                if (isDesktopOverlayActiveV132 || webView == null) return;
                wmV132 = (android.view.WindowManager) getApplicationContext().getSystemService(WINDOW_SERVICE);
                float density = getResources().getDisplayMetrics().density;
                int wPx = (savedOverlayW > 48) ? savedOverlayW : Math.round(300 * density);
                int hPx = (savedOverlayH > 32) ? savedOverlayH : Math.round(176 * density);

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

                overlayContainerV132 = new android.widget.FrameLayout(getApplicationContext()) {
                    private float downRawX = 0f, downRawY = 0f;
                    private int startWinX = 0, startWinY = 0;
                    private boolean isDragging = false;
                    private boolean isPinching = false;
                    private float initSpan = 1f, initFocusX = 0f, initFocusY = 0f;
                    private int pinchStartW = 0, pinchStartH = 0, pinchStartX = 0, pinchStartY = 0;

                    private void cancelWebViewTouch(android.view.MotionEvent ev) {
                        android.view.MotionEvent cancelEv = android.view.MotionEvent.obtain(ev);
                        cancelEv.setAction(android.view.MotionEvent.ACTION_CANCEL);
                        super.dispatchTouchEvent(cancelEv);
                        cancelEv.recycle();
                    }

                    @Override
                    public boolean dispatchTouchEvent(android.view.MotionEvent ev) {
                        if (!isDesktopOverlayActiveV132 || wmV132 == null || overlayParamsV132 == null) {
                            return super.dispatchTouchEvent(ev);
                        }
                        int action = ev.getActionMasked();
                        float viewOriginX = ev.getRawX() - ev.getX();
                        float viewOriginY = ev.getRawY() - ev.getY();

                        if (action == android.view.MotionEvent.ACTION_DOWN) {
                            downRawX = ev.getRawX();
                            downRawY = ev.getRawY();
                            startWinX = overlayParamsV132.x;
                            startWinY = overlayParamsV132.y;
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
                            float rx0 = viewOriginX + ev.getX(0);
                            float ry0 = viewOriginY + ev.getY(0);
                            float rx1 = viewOriginX + ev.getX(1);
                            float ry1 = viewOriginY + ev.getY(1);
                            initSpan = (float) Math.max(8.0, Math.hypot(rx1 - rx0, ry1 - ry0));
                            initFocusX = (rx0 + rx1) * 0.5f;
                            initFocusY = (ry0 + ry1) * 0.5f;
                            pinchStartW = overlayParamsV132.width;
                            pinchStartH = overlayParamsV132.height;
                            pinchStartX = overlayParamsV132.x;
                            pinchStartY = overlayParamsV132.y;
                            return true;
                        }

                        if (action == android.view.MotionEvent.ACTION_MOVE) {
                            if (isPinching && ev.getPointerCount() >= 2) {
                                float rx0 = viewOriginX + ev.getX(0);
                                float ry0 = viewOriginY + ev.getY(0);
                                float rx1 = viewOriginX + ev.getX(1);
                                float ry1 = viewOriginY + ev.getY(1);
                                float curSpan = (float) Math.max(8.0, Math.hypot(rx1 - rx0, ry1 - ry0));
                                float curFocusX = (rx0 + rx1) * 0.5f;
                                float curFocusY = (ry0 + ry1) * 0.5f;
                                float scale = curSpan / initSpan;

                                int newW = Math.max(48, Math.round(pinchStartW * scale));
                                int newH = Math.max(32, Math.round(pinchStartH * scale));
                                float actualScaleX = (float) newW / Math.max(1, pinchStartW);
                                float actualScaleY = (float) newH / Math.max(1, pinchStartH);

                                overlayParamsV132.width = newW;
                                overlayParamsV132.height = newH;
                                overlayParamsV132.x = Math.round(curFocusX - (initFocusX - pinchStartX) * actualScaleX);
                                overlayParamsV132.y = Math.round(curFocusY - (initFocusY - pinchStartY) * actualScaleY);
                                savedOverlayW = newW;
                                savedOverlayH = newH;
                                savedOverlayX = overlayParamsV132.x;
                                savedOverlayY = overlayParamsV132.y;
                                wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                                return true;
                            } else if (!isPinching && ev.getPointerCount() == 1) {
                                float dx = ev.getRawX() - downRawX;
                                float dy = ev.getRawY() - downRawY;
                                if (!isDragging && Math.hypot(dx, dy) > 8.0) {
                                    isDragging = true;
                                    cancelWebViewTouch(ev);
                                }
                                if (isDragging) {
                                    overlayParamsV132.x = Math.round(startWinX + dx);
                                    overlayParamsV132.y = Math.round(startWinY + dy);
                                    savedOverlayX = overlayParamsV132.x;
                                    savedOverlayY = overlayParamsV132.y;
                                    wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                                    return true;
                                }
                            }
                            return super.dispatchTouchEvent(ev);
                        }

                        if (action == android.view.MotionEvent.ACTION_POINTER_UP) {
                            if (ev.getPointerCount() <= 2) {
                                int remIdx = (ev.getActionIndex() == 0) ? 1 : 0;
                                downRawX = viewOriginX + ev.getX(remIdx);
                                downRawY = viewOriginY + ev.getY(remIdx);
                                startWinX = overlayParamsV132.x;
                                startWinY = overlayParamsV132.y;
                                isPinching = false;
                                isDragging = true;
                            }
                            return true;
                        }

                        if (action == android.view.MotionEvent.ACTION_UP || action == android.view.MotionEvent.ACTION_CANCEL) {
                            if (isDragging || isPinching) {
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
            }
        });
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isVideoActiveV132 && !isDesktopOverlayActiveV132) {
            enterDesktopOverlayInternalV133();
        }
    }

    public static void evalJs(final String script) {
        if (instance != null && instance.webView != null) {
            instance.webView.post(() -> instance.webView.evaluateJavascript(script, null));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        handleIncomingTorrentIntent(getIntent());

        // 1. Сразу регистрируем канал уведомлений при старте!
        // Это мгновенно разблокирует серый тумблер в настройках Android 13-16
        PlaybackService.ensureChannel(this);

        // 2. Запрашиваем разрешение на показ уведомлений
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_PERM_NOTIF);
            }
        }

        if (webView != null) {
            if (webView.getParent() instanceof android.view.ViewGroup) {
                ((android.view.ViewGroup) webView.getParent()).removeView(webView);
            }
            setContentView(webView);
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
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((isVideoFullscreenV132 || isVideoLockedV132) && (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0) {
                applyVideoSystemUiLockV132();
            }
        });

        setupFFmpeg();
        checkPermissionsAndStart();
    }

    public class WebAppInterface {
                @JavascriptInterface
        public void setVideoFullscreenLock(boolean fullscreen, boolean locked) {
            isVideoFullscreenV132 = fullscreen;
            isVideoLockedV132 = locked;
            applyVideoSystemUiLockV132();
        }

        @JavascriptInterface
        public boolean canDrawOverlays() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(MainActivity.this);
            }
            return true;
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public void setVideoActiveState(boolean active) {
            isVideoActiveV132 = active;
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
            runOnUiThread(() -> {
                try {
                    if (!isDesktopOverlayActiveV132) return;
                    isDesktopOverlayActiveV132 = false;
                    if (overlayContainerV132 != null) {
                        overlayContainerV132.removeAllViews();
                        if (wmV132 != null) {
                            try { wmV132.removeView(overlayContainerV132); } catch (Exception ignored) {}
                        }
                        overlayContainerV132 = null;
                    }
                    if (webView != null) {
                        if (webView.getParent() instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) webView.getParent()).removeView(webView);
                        }
                        setContentView(webView);
                    }
                    if (bringToFront) {
                        Intent i = new Intent(MainActivity.this, MainActivity.class);
                        i.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        startActivity(i);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
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
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    startActivityForResult(intent, REQ_PICK_FOLDER);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
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

    private void checkPermissionsAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                Uri uri = Uri.fromParts("package", getPackageName(), null);
                intent.setData(uri);
                startActivity(intent);
            } else {
                startPythonServer();
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE}, REQ_PERM_STORAGE);
            } else {
                startPythonServer();
            }
        }
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
        if (isDesktopOverlayActiveV132) {
            evalJs("if(window.exitDesktopOverlayModeV132) window.exitDesktopOverlayModeV132(false);");
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
            startPythonServer();
        }
    }

    private void startPythonServer() {
        if (!Python.isStarted()) {
            Python.start(new AndroidPlatform(this));
            new Thread(() -> {
                Python.getInstance().getModule("player").callAttr("start_server");
            }).start();
            isPageLoaded = true;
            webView.postDelayed(() -> webView.loadUrl("http://127.0.0.1:8080"), 1500);
        } else if (!isPageLoaded) {
            isPageLoaded = true;
            webView.loadUrl("http://127.0.0.1:8080");
        }
    }
}
