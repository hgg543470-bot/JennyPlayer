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
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends AppCompatActivity {
    private static final int REQ_PERM_STORAGE = 1;
    private static final int REQ_PICK_FOLDER = 42;
    private WebView webView;
    private boolean isPageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        setupFFmpeg();
        checkPermissionsAndStart();
    }

    public class WebAppInterface {
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
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
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
            String nativeDir = getApplicationInfo().nativeLibraryDir;
            File ffmpegFile = new File(getFilesDir(), "ffmpeg");
            if (!ffmpegFile.exists()) {
                try {
                    InputStream is = getAssets().open("ffmpeg");
                    FileOutputStream fos = new FileOutputStream(ffmpegFile);
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = is.read(buffer)) != -1) {
                        fos.write(buffer, 0, read);
                    }
                    fos.close();
                    is.close();
                    ffmpegFile.setExecutable(true);
                } catch (Exception ignored) {
                }
            } else {
                ffmpegFile.setExecutable(true);
            }
            String path = System.getenv("PATH");
            String extraPath = getFilesDir().getAbsolutePath() + ":" + nativeDir;
            Os.setenv("PATH", extraPath + ":" + path, true);
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
