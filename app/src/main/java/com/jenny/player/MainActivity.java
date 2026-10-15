package com.jenny.player;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.system.Os;
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
    private WebView webView;

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

        setupFFmpeg();
        checkPermissionsAndStart();
    }

    private void setupFFmpeg() {
        try {
            File ffmpegFile = new File(getFilesDir(), "ffmpeg");
            if (!ffmpegFile.exists()) {
                InputStream is = getAssets().open("ffmpeg");
                FileOutputStream fos = new FileOutputStream(ffmpegFile);
                byte[] buffer = new byte[1024];
                int read;
                while ((read = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, read);
                }
                fos.close();
                is.close();
                ffmpegFile.setExecutable(true);
            }
            // Подсовываем ffmpeg в переменные среды, чтобы Python его нашел
            String path = System.getenv("PATH");
            Os.setenv("PATH", path + ":" + getFilesDir().getAbsolutePath(), true);
        } catch (Exception e) {
            e.printStackTrace(); // Если ffmpeg нет в assets, просто идем дальше
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
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE}, 1);
            } else {
                startPythonServer();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Перезапускаем проверку прав, если юзер вернулся из настроек
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
            if (!Python.isStarted()) {
                startPythonServer();
            }
        }
    }

    private void startPythonServer() {
        if (!Python.isStarted()) {
            Python.start(new AndroidPlatform(this));
            new Thread(() -> {
                Python.getInstance().getModule("player").callAttr("start_server");
            }).start();
            webView.postDelayed(() -> webView.loadUrl("http://127.0.0.1:8080"), 1500);
        }
    }
}
