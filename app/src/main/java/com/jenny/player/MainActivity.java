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
    private static boolean pendingOverlayAfterGrantV147 = false;
    private static boolean waitingForPermScreenV148 = false;
    private static int permWatchTicksV147 = 0;
    private static final android.os.Handler permWatchHandlerV147 = new android.os.Handler(android.os.Looper.getMainLooper());
    private static Runnable permWatchRunnableV147 = null;
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
        if (hasFocus && isDesktopOverlayActiveV132) {
            restoreWebViewToActivityV135(false);
        }
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
                android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
                float density = dm.density;
                final int maxHwW = Math.max(1080, dm.widthPixels);
                final int maxHwH = Math.max(1920, dm.heightPixels);

                int wPx = (savedOverlayW > 48) ? Math.min(maxHwW, savedOverlayW) : Math.round(300 * density);
                int hPx = (savedOverlayH > 32) ? Math.min(maxHwH, savedOverlayH) : Math.round(176 * density);

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
                webView.setScaleX(1.0f);
                webView.setScaleY(1.0f);

                overlayContainerV132 = new android.widget.FrameLayout(getApplicationContext()) {
                    private float downRawX = 0f, downRawY = 0f;
                    private int startWinX = 0, startWinY = 0;
                    private boolean isDragging = false;
                    private boolean isPinching = false;
                    private float initSpan = 1f, initFocusX = 0f, initFocusY = 0f;
                    private int pinchStartW = 0, pinchStartH = 0, pinchStartX = 0, pinchStartY = 0;
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
                        virtualW = Math.max(48, Math.min(maxHwW * 3, targetW));
                        virtualH = Math.max(32, Math.min(maxHwH * 3, targetH));

                        // Ограничиваем физический буфер SurfaceFlinger размером экрана, а все что больше — дожимаем GPU-масштабом WebView!
                        int hwW = Math.min(maxHwW, virtualW);
                        int hwH = Math.min(maxHwH, virtualH);
                        float extraScaleX = (float) virtualW / Math.max(1, hwW);
                        float extraScaleY = (float) virtualH / Math.max(1, hwH);

                        if (webView != null) {
                            webView.setPivotX(0f);
                            webView.setPivotY(0f);
                            webView.setScaleX(extraScaleX);
                            webView.setScaleY(extraScaleY);
                        }

                        overlayParamsV132.x = targetX;
                        overlayParamsV132.y = targetY;
                        savedOverlayX = targetX;
                        savedOverlayY = targetY;

                        long now = android.os.SystemClock.uptimeMillis();
                        boolean sizeChanged = (Math.abs(hwW - overlayParamsV132.width) >= 6) || (Math.abs(hwH - overlayParamsV132.height) >= 6);
                        if (forceSync || !sizeChanged || (now - lastLayoutUpdateMs >= 28L)) {
                            overlayParamsV132.width = hwW;
                            overlayParamsV132.height = hwH;
                            savedOverlayW = hwW;
                            savedOverlayH = hwH;
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
                            if (virtualW < 48) virtualW = overlayParamsV132.width;
                            if (virtualH < 32) virtualH = overlayParamsV132.height;
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
                            pinchStartW = Math.max(48, virtualW);
                            pinchStartH = Math.max(32, virtualH);
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

                                int newW = Math.max(48, Math.round(pinchStartW * scale));
                                int newH = Math.max(32, Math.round(pinchStartH * scale));
                                float actualScaleX = (float) newW / Math.max(1, pinchStartW);
                                float actualScaleY = (float) newH / Math.max(1, pinchStartH);

                                int newX = Math.round(curFocusX - (initFocusX - pinchStartX) * actualScaleX);
                                int newY = Math.round(curFocusY - (initFocusY - pinchStartY) * actualScaleY);
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
                                    overlayParamsV132.x = Math.round(startWinX + dx);
                                    overlayParamsV132.y = Math.round(startWinY + dy);
                                    savedOverlayX = overlayParamsV132.x;
                                    savedOverlayY = overlayParamsV132.y;
                                    try {
                                        wmV132.updateViewLayout(overlayContainerV132, overlayParamsV132);
                                    } catch (Exception ignored) {}
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

    private void stopOverlayPermWatcherV147() {
        if (permWatchRunnableV147 != null) {
            permWatchHandlerV147.removeCallbacks(permWatchRunnableV147);
            permWatchRunnableV147 = null;
        }
    }

    private void openMiuiOrSystemOverlayWindowV148() {
        try {
            String pkg = getPackageName();
            boolean launched = false;
            int flags = Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP;

            String[] miuiClasses = new String[]{
                "com.miui.permcenter.permissions.PermissionsEditorActivity",
                "com.miui.permcenter.permissions.AppPermissionsEditorActivity"
            };
            for (String cls : miuiClasses) {
                try {
                    Intent miuiIntent = new Intent("miui.intent.action.APP_PERM_EDITOR");
                    miuiIntent.setClassName("com.miui.securitycenter", cls);
                    miuiIntent.putExtra("extra_pkgname", pkg);
                    miuiIntent.addFlags(flags);
                    startActivity(miuiIntent);
                    launched = true;
                    break;
                } catch (Exception ignored) {}
            }

            if (!launched) {
                try {
                    Intent miuiPkgIntent = new Intent("miui.intent.action.APP_PERM_EDITOR");
                    miuiPkgIntent.setPackage("com.miui.securitycenter");
                    miuiPkgIntent.putExtra("extra_pkgname", pkg);
                    miuiPkgIntent.addFlags(flags);
                    startActivity(miuiPkgIntent);
                    launched = true;
                } catch (Exception ignored) {}
            }

            if (!launched && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + pkg));
                    intent.addFlags(flags);
                    startActivity(intent);
                    launched = true;
                } catch (Exception ignored) {}
            }

            if (!launched) {
                Intent appDetails = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + pkg));
                appDetails.addFlags(flags);
                startActivity(appDetails);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void launchOverlayPermissionWithAutoWatchV147(final boolean fromHomeButton) {
        runOnUiThread(() -> {
            try {
                isOpeningSettingsV146 = true;
                pendingOverlayAfterGrantV147 = true;
                waitingForPermScreenV148 = fromHomeButton;
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
                    "🔓 Включи «Отображение всплывающих окон» ➔ «Всегда разрешать»",
                    android.widget.Toast.LENGTH_LONG
                ).show();

                if (fromHomeButton) {
                    // Ждём 350 мс, чтобы завершилась системная анимация выхода на рабочий стол, и открываем окно поверх лаунчера!
                    permWatchHandlerV147.postDelayed(() -> {
                        if (!Settings.canDrawOverlays(MainActivity.this)) {
                            openMiuiOrSystemOverlayWindowV148();
                        }
                    }, 350);
                } else {
                    openMiuiOrSystemOverlayWindowV148();
                }

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
                            if (pendingOverlayAfterGrantV147 && isVideoActiveV132) {
                                pendingOverlayAfterGrantV147 = false;
                                enterDesktopOverlayInternalV133();
                                evalJs("if(window.ensureVideoPlayingInOverlayV147) window.ensureVideoPlayingInOverlayV147();");
                                try {
                                    Intent home = new Intent(Intent.ACTION_MAIN);
                                    home.addCategory(Intent.CATEGORY_HOME);
                                    home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(home);
                                } catch (Exception ignored) {}
                            }
                            return;
                        }
                        if (permWatchTicksV147 < 240) {
                            permWatchHandlerV147.postDelayed(this, 250);
                        }
                    }
                };
                permWatchHandlerV147.postDelayed(permWatchRunnableV147, 300);
            } catch (Exception e) {
                isOpeningSettingsV146 = false;
                pendingOverlayAfterGrantV147 = false;
                waitingForPermScreenV148 = false;
                e.printStackTrace();
            }
        });
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isOpeningSettingsV146) {
            return;
        }
        if (isVideoActiveV132 && !isDesktopOverlayActiveV132) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
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
            webView.setScaleX(1.0f);
                        webView.setScaleY(1.0f);
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
        webView.setScaleX(1.0f);
                        webView.setScaleY(1.0f);
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
            launchOverlayPermissionWithAutoWatchV147(false);
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
        boolean granted = (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) || Settings.canDrawOverlays(this);

        // Если после нажатия Home система не дала открыть окно поверх лаунчера и пользователь вернулся в плеер — открываем скр 2 прямо сейчас!
        if (waitingForPermScreenV148 && !granted && isVideoActiveV132) {
            waitingForPermScreenV148 = false;
            isOpeningSettingsV146 = true;
            pendingOverlayAfterGrantV147 = true;
            permWatchHandlerV147.postDelayed(() -> openMiuiOrSystemOverlayWindowV148(), 120);
            return;
        }

        stopOverlayPermWatcherV147();
        boolean wasPermSettings = isOpeningSettingsV146;
        boolean wantAutoOverlay = pendingOverlayAfterGrantV147;
        isOpeningSettingsV146 = false;
        pendingOverlayAfterGrantV147 = false;
        waitingForPermScreenV148 = false;

        if (wasPermSettings && wantAutoOverlay && granted && isVideoActiveV132 && !isDesktopOverlayActiveV132) {
            enterDesktopOverlayInternalV133();
            evalJs("if(window.ensureVideoPlayingInOverlayV147) window.ensureVideoPlayingInOverlayV147();");
            moveTaskToBack(true);
            return;
        }

        restoreWebViewToActivityV135(false);
        if (wasPermSettings && webView != null) {
            webView.postDelayed(() -> {
                evalJs("if(window.onReturnedFromPermissionScreenV146) window.onReturnedFromPermissionScreenV146(" + granted + ");");
                if (isVideoFullscreenV132 || isVideoLockedV132) {
                    applyVideoSystemUiLockV132();
                }
            }, 180);
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
