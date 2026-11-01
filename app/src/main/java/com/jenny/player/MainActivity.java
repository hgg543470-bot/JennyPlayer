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

        setupFFmpeg();
        checkPermissionsAndStart();
    }

    public class WebAppInterface {
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
