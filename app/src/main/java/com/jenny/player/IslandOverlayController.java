package com.jenny.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Resources;
import android.graphics.Canvas;
import android.graphics.Insets;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Display;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowMetrics;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import java.util.Locale;

/**
 * [FIX-ISLAND-OVERLAY] Отдельный контроллер верхней плашки плеера (Dynamic Island Overlay V246).
 * Реализует:
 * 1. Автоматический расчёт реальных размеров экрана, DPI и высоты системной строки состояния (statusBarTopInset).
 * 2. Свёрнутую мини-плашку прямо ПОД строкой состояния (не перекрывается статус-баром и чётко нажимается с рабочего стола).
 * 3. Полное скрытие плашки при входе в сам Jenny Player (не занимает место внутри приложения) и появление мини-плашки при сворачивании.
 * 4. Автоматическое сворачивание большой плашки в мини-плашку при нажатии «Домой», «Назад» или касании вне плашки.
 * 5. Компактные векторные значки источников (как в шапке плеера: фиолетовая нота Музыки, голубой локатор Радио, оранжевое облачко SoundCloud, красный экран YouTube).
 * 6. Полную хамелеон-перекраску всего интерфейса плашки и мини-капсулы (рамка, фон, диск, таймер, ползунок Seek, кнопки транспорта) в цвет активного значка источника (при этом сами 4 значка переключения сохраняют свои фирменные цвета).
 */
public class IslandOverlayController {
    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private FrameLayout islandRootContainer;
    private LinearLayout expandedPlateCard;
    private LinearLayout collapsedMiniPill;
    private WindowManager.LayoutParams islandLayoutParams;
    private boolean isIslandAttached = false;
    private boolean isIslandExpanded = false; // По умолчанию при сворачивании плеера появляется компактная мини-плашка
    private boolean isAppInForeground = false;
    private boolean isUserSeekingIsland = false;
    private boolean receiverRegistered = false;

    // Состояние медиа и модулей
    private String currentTitle = "Jenny Player • Студия активна";
    private String currentSubtitle = "🛡️ Фоновый движок 24/7 (P2P + 32-bit DSP)";
    private boolean isPlaying = false;
    private long currentPosMs = 0L;
    private long currentDurMs = 0L;
    private float currentSpeed = 1.0f;
    private long lastPosUpdateUptimeMs = 0L;
    private boolean isCurrentTrackFav = false;
    private String currentIslandMode = "music"; // "music" | "radio" | "soundcloud" | "youtube"
    private String currentRawTrack = "";

    // Фирменные цвета значков источников (сами значки всегда остаются в своих цветах)
    private static final int COLOR_ICON_MUSIC      = 0xFFA371F7; // Фиолетовый неон
    private static final int COLOR_ICON_RADIO      = 0xFF58A6FF; // Голубой неон (как в шапке плеера)
    private static final int COLOR_ICON_SOUNDCLOUD = 0xFFFF8C42; // Оранжевое облачко SoundCloud
    private static final int COLOR_ICON_YOUTUBE    = 0xFFFF5555; // Красный неон YouTube

    // Виджеты развёрнутой плашки
    private GradientDrawable plateCardBgDrawable;
    private SourceIconView modeBtnMusic;
    private SourceIconView modeBtnRadio;
    private SourceIconView modeBtnSoundCloud;
    private SourceIconView modeBtnYoutube;
    private TextView activeModeBadgeView;
    private GradientDrawable activeModeBadgeBg;
    private TextView openAppBtn;
    private GradientDrawable openAppBtnBg;
    private TextView collapseBtn;
    private GradientDrawable collapseBtnBg;

    private SourceIconView discIconView;
    private TextView discBadgeTagView;
    private GradientDrawable discCircleDrawable;
    private TextView islandTitleView;
    private TextView islandSubtitleView;
    private TextView favHeartBtn;
    private GradientDrawable favHeartBgDrawable;

    private TextView elapsedTimeView;
    private TextView totalTimeView;
    private SeekBar islandSeekBar;
    private GradientDrawable seekBgTrackDrawable;
    private GradientDrawable seekProgGradDrawable;
    private GradientDrawable seekThumbDrawable;

    private TextView btnRew10;
    private GradientDrawable btnRew10Bg;
    private TextView btnPrev;
    private GradientDrawable btnPrevBg;
    private TextView btnPlayPause;
    private GradientDrawable btnPlayPauseBgDrawable;
    private TextView btnNext;
    private GradientDrawable btnNextBg;
    private TextView btnFwd10;
    private GradientDrawable btnFwd10Bg;

    // Виджеты свёрнутой мини-капсулы
    private GradientDrawable miniPillBgDrawable;
    private SourceIconView miniPillIconView;
    private TextView miniPillTitleView;
    private TextView miniPillPlayBtn;
    private GradientDrawable miniPillPlayBtnBg;
    private TextView miniPillExpandIcon;

    // Реальные метрики экрана и адаптивный шаг масштабирования u
    private int lastScreenW = 0;
    private int lastScreenH = 0;
    private int lastDensityDpi = 0;
    private float unitPx = 3.0f;
    private int expandedPlateW = 1087;
    private int expandedPlateH = 502;
    private int expandedPlateY = 156;
    private int collapsedPillW = 636;
    private int collapsedPillH = 96;
    private int collapsedPillY = 150;

    private final BroadcastReceiver systemNavigationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (intent == null) return;
            String act = intent.getAction();
            if (Intent.ACTION_CLOSE_SYSTEM_DIALOGS.equals(act) || Intent.ACTION_SCREEN_OFF.equals(act)) {
                // При нажатии кнопки/жеста «Домой» или «Недавние» сворачиваем большую плашку в мини-плашку!
                if (isIslandExpanded) {
                    setExpanded(false);
                }
            }
        }
    };

    private final Runnable progressTickerRunnable = new Runnable() {
        @Override
        public void run() {
            if (isIslandAttached && !isAppInForeground && isIslandExpanded && !isUserSeekingIsland) {
                refreshIslandProgressOnly();
            }
            if (isIslandAttached) {
                mainHandler.postDelayed(this, 250L);
            }
        }
    };

    /**
     * Кастомный векторный значок источника (рисует точные векторные иконки из шапки Jenny Player).
     */
    private final class SourceIconView extends View {
        private String sourceType;
        private int iconColor;
        private boolean isSelectedTab = false;
        private final boolean isTabButton;
        private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rectF = new RectF();
        private final GradientDrawable tabBg = new GradientDrawable();

        SourceIconView(Context ctx, String sourceType, int defaultColor, boolean isTabButton) {
            super(ctx);
            this.sourceType = sourceType;
            this.iconColor = defaultColor;
            this.isTabButton = isTabButton;

            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeCap(Paint.Cap.ROUND);
            strokePaint.setStrokeJoin(Paint.Join.ROUND);

            fillPaint.setStyle(Paint.Style.FILL);

            if (isTabButton) {
                tabBg.setCornerRadius(U(9.5f));
                setBackground(tabBg);
                updateTabVisualState(false);
            }
        }

        void setSourceTypeAndColor(String newType, int newColor) {
            boolean changed = !String.valueOf(this.sourceType).equals(newType) || this.iconColor != newColor;
            this.sourceType = newType;
            this.iconColor = newColor;
            if (changed) {
                invalidate();
            }
        }

        void updateTabVisualState(boolean selected) {
            this.isSelectedTab = selected;
            if (isTabButton) {
                int alphaFill = selected ? ((iconColor & 0x00FFFFFF) | 0x38000000) : 0xFF101624;
                int borderCol = selected ? iconColor : 0xFF283246;
                tabBg.setColor(alphaFill);
                tabBg.setStroke(U(selected ? 1.5f : 1.0f), borderCol);
            }
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return;

            float size = Math.min(w, h) * (isTabButton ? 0.64f : 0.72f);
            float ox = (w - size) * 0.5f;
            float oy = (h - size) * 0.5f;
            float s = size / 24.0f;

            strokePaint.setColor(iconColor);
            strokePaint.setStrokeWidth(Math.max(2.0f, 2.05f * s));
            fillPaint.setColor(iconColor);

            if ("soundcloud".equals(sourceType)) {
                // Оранжевое облачко SoundCloud + 3 полоски эквалайзера слева (точно по JENNY_NEON_SVGS_V92.soundcloud)
                canvas.drawLine(ox + 2.2f * s, oy + 12.8f * s, ox + 2.2f * s, oy + 17.5f * s, strokePaint);
                canvas.drawLine(ox + 5.0f * s, oy + 9.8f * s,  ox + 5.0f * s, oy + 17.8f * s, strokePaint);
                canvas.drawLine(ox + 7.8f * s, oy + 11.2f * s, ox + 7.8f * s, oy + 17.8f * s, strokePaint);

                path.reset();
                path.moveTo(ox + 10.5f * s, oy + 17.8f * s);
                path.lineTo(ox + 18.5f * s, oy + 17.8f * s);
                rectF.set(ox + 15.2f * s, oy + 11.0f * s, ox + 21.8f * s, oy + 17.8f * s);
                path.arcTo(rectF, 90f, -180f, false);
                rectF.set(ox + 9.6f * s, oy + 6.8f * s, ox + 19.0f * s, oy + 16.0f * s);
                path.arcTo(rectF, -15f, -165f, false);
                rectF.set(ox + 8.6f * s, oy + 11.4f * s, ox + 13.4f * s, oy + 17.8f * s);
                path.arcTo(rectF, -90f, -180f, false);
                path.close();
                canvas.drawPath(path, strokePaint);
            } else if ("radio".equals(sourceType)) {
                // Спутниковый радар / радиоприёмник с волнами (точно по JENNY_NEON_SVGS_V92.radio)
                rectF.set(ox + 3.2f * s, oy + 6.8f * s, ox + 17.2f * s, oy + 20.8f * s);
                canvas.drawArc(rectF, 45f, 180f, true, strokePaint);
                canvas.drawLine(ox + 9.2f * s, oy + 15.2f * s, ox + 14.2f * s, oy + 10.2f * s, strokePaint);
                canvas.drawCircle(ox + 14.8f * s, oy + 9.6f * s, 1.4f * s, fillPaint);

                // Волны сигнала
                rectF.set(ox + 11.0f * s, oy + 5.8f * s, ox + 18.2f * s, oy + 13.0f * s);
                canvas.drawArc(rectF, -80f, 75f, false, strokePaint);
                rectF.set(ox + 9.0f * s, oy + 3.2f * s, ox + 20.8f * s, oy + 15.0f * s);
                canvas.drawArc(rectF, -80f, 75f, false, strokePaint);

                // Основание
                path.reset();
                path.moveTo(ox + 4.8f * s, oy + 21.0f * s);
                path.lineTo(ox + 8.0f * s, oy + 17.2f * s);
                path.lineTo(ox + 11.2f * s, oy + 21.0f * s);
                path.close();
                canvas.drawPath(path, strokePaint);
            } else if ("youtube".equals(sourceType)) {
                // Красный экран YouTube с треугольником Play (точно по JENNY_NEON_SVGS_V92.youtube)
                rectF.set(ox + 2.2f * s, oy + 4.8f * s, ox + 21.8f * s, oy + 19.2f * s);
                canvas.drawRoundRect(rectF, 4.2f * s, 4.2f * s, strokePaint);

                path.reset();
                path.moveTo(ox + 9.8f * s, oy + 8.8f * s);
                path.lineTo(ox + 15.8f * s, oy + 12.0f * s);
                path.lineTo(ox + 9.8f * s, oy + 15.2f * s);
                path.close();
                canvas.drawPath(path, fillPaint);
            } else {
                // Фиолетовая двойная нота Студийной Музыки ("music")
                canvas.drawCircle(ox + 6.5f * s, oy + 17.5f * s, 2.5f * s, fillPaint);
                canvas.drawCircle(ox + 16.5f * s, oy + 15.5f * s, 2.5f * s, fillPaint);
                canvas.drawLine(ox + 8.8f * s, oy + 17.5f * s, ox + 8.8f * s, oy + 6.2f * s, strokePaint);
                canvas.drawLine(ox + 18.8f * s, oy + 15.5f * s, ox + 18.8f * s, oy + 4.2f * s, strokePaint);
                canvas.drawLine(ox + 8.8f * s, oy + 6.2f * s, ox + 18.8f * s, oy + 4.2f * s, strokePaint);
                canvas.drawLine(ox + 8.8f * s, oy + 9.4f * s, ox + 18.8f * s, oy + 7.4f * s, strokePaint);
            }
        }
    }

    public IslandOverlayController(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
        registerNavigationReceiver();
    }

    private void registerNavigationReceiver() {
        if (receiverRegistered) return;
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(systemNavigationReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                context.registerReceiver(systemNavigationReceiver, filter);
            }
            receiverRegistered = true;
        } catch (Throwable ignored) {}
    }

    private void unregisterNavigationReceiver() {
        if (!receiverRegistered) return;
        try {
            context.unregisterReceiver(systemNavigationReceiver);
        } catch (Throwable ignored) {}
        receiverRegistered = false;
    }

    public boolean canDrawOverlay() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public boolean isExpanded() {
        return isIslandExpanded;
    }

    public void toggleExpanded() {
        setExpanded(!isIslandExpanded);
    }

    /**
     * Вызывается из MainActivity при входе в плеер (true -> полностью скрыть плашку)
     * и при выходе/сворачивании на рабочий стол (false -> показать мини-плашку под статус-баром).
     */
    public void setAppInForeground(final boolean inForeground) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                boolean changed = (isAppInForeground != inForeground);
                isAppInForeground = inForeground;
                if (inForeground) {
                    // При заходе в плеер сбрасываем разворот, чтобы при следующем сворачивании появилась аккуратная мини-плашка
                    isIslandExpanded = false;
                }
                ensureAttached();
                if (changed || isIslandAttached) {
                    applyWindowLayoutState();
                    refreshUi();
                }
            }
        });
    }

    public void setExpanded(final boolean expanded) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                isIslandExpanded = expanded;
                if (!isIslandAttached || islandRootContainer == null || windowManager == null) return;
                computeRealMetricsAndScale();
                applyWindowLayoutState();
                refreshUi();
            }
        });
    }

    private void applyWindowLayoutState() {
        if (!isIslandAttached || islandRootContainer == null || windowManager == null || islandLayoutParams == null) {
            return;
        }
        computeRealMetricsAndScale();

        int baseFlags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED;

        if (isAppInForeground) {
            // Внутри самого приложения Jenny Player плашка полностью скрыта и не занимает ни пикселя!
            expandedPlateCard.setVisibility(View.GONE);
            collapsedMiniPill.setVisibility(View.GONE);
            islandRootContainer.setVisibility(View.GONE);
            islandLayoutParams.width = 0;
            islandLayoutParams.height = 0;
            islandLayoutParams.y = collapsedPillY;
            islandLayoutParams.flags = baseFlags
                    | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        } else if (isIslandExpanded) {
            // Развёрнутая большая плашка: принимает кнопку «Назад» (без FLAG_NOT_FOCUSABLE) и касание снаружи (FLAG_WATCH_OUTSIDE_TOUCH)
            islandRootContainer.setVisibility(View.VISIBLE);
            expandedPlateCard.setVisibility(View.VISIBLE);
            collapsedMiniPill.setVisibility(View.GONE);
            islandLayoutParams.width = expandedPlateW;
            islandLayoutParams.height = expandedPlateH;
            islandLayoutParams.y = expandedPlateY;
            islandLayoutParams.flags = baseFlags
                    | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH;
            islandRootContainer.setFocusableInTouchMode(true);
            islandRootContainer.requestFocus();
        } else {
            // Свёрнутая мини-плашка прямо под строкой состояния: не перехватывает клавиатуру/Назад у других приложений
            islandRootContainer.setVisibility(View.VISIBLE);
            expandedPlateCard.setVisibility(View.GONE);
            collapsedMiniPill.setVisibility(View.VISIBLE);
            islandLayoutParams.width = collapsedPillW;
            islandLayoutParams.height = collapsedPillH;
            islandLayoutParams.y = collapsedPillY;
            islandLayoutParams.flags = baseFlags
                    | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }

        try {
            windowManager.updateViewLayout(islandRootContainer, islandLayoutParams);
        } catch (Throwable ignored) {}
    }

    public void updateMediaState(
            final String title,
            final String subtitle,
            final boolean playing,
            final long posMs,
            final long durMs,
            final float speed) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (title != null && !title.isEmpty()) {
                    currentTitle = title;
                }
                if (subtitle != null && !subtitle.isEmpty()) {
                    currentSubtitle = subtitle;
                }
                isPlaying = playing;
                currentPosMs = posMs;
                currentDurMs = durMs;
                currentSpeed = speed;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                ensureAttached();
                refreshUi();
            }
        });
    }

    public void updateExtraState(final boolean isFav, final String mode, final String rawTrack) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                isCurrentTrackFav = isFav;
                if (mode != null && !mode.isEmpty()) {
                    currentIslandMode = mode.toLowerCase(Locale.ROOT);
                }
                if (rawTrack != null) {
                    currentRawTrack = rawTrack;
                }
                ensureAttached();
                refreshUi();
            }
        });
    }

    public void onSeekTo(final long posMs) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                currentPosMs = posMs;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshIslandProgressOnly();
            }
        });
    }

    public void onConfigurationChanged() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                rebuildForMetricsChange();
            }
        });
    }

    public void ensureAttached() {
        if (!canDrawOverlay()) {
            destroy();
            return;
        }
        registerNavigationReceiver();
        if (isIslandAttached && islandRootContainer != null) {
            DisplayMetrics dm = context.getResources().getDisplayMetrics();
            if (dm.widthPixels != lastScreenW || dm.densityDpi != lastDensityDpi) {
                rebuildForMetricsChange();
            }
            return;
        }
        buildAndAttach();
    }

    public void rebuildForMetricsChange() {
        if (!canDrawOverlay()) {
            destroy();
            return;
        }
        boolean wasExpanded = isIslandExpanded;
        boolean wasFg = isAppInForeground;
        removeWindowOnly();
        isIslandExpanded = wasExpanded;
        isAppInForeground = wasFg;
        buildAndAttach();
        applyWindowLayoutState();
        refreshUi();
    }

    private void removeWindowOnly() {
        mainHandler.removeCallbacks(progressTickerRunnable);
        if (windowManager != null && islandRootContainer != null && isIslandAttached) {
            try {
                windowManager.removeViewImmediate(islandRootContainer);
            } catch (Throwable ignored) {
                try {
                    windowManager.removeView(islandRootContainer);
                } catch (Throwable ignored2) {}
            }
        }
        isIslandAttached = false;
        islandRootContainer = null;
    }

    public void destroy() {
        unregisterNavigationReceiver();
        removeWindowOnly();
    }

    /**
     * Автоматически определяет реальный верхний отступ системной строки состояния и выреза камеры.
     */
    private int getRealStatusBarTopInsetPx() {
        int insetTop = 0;

        // 1) Современный API WindowMetrics (Android 11+ / API 30+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && windowManager != null) {
            try {
                WindowMetrics wmMetrics = windowManager.getCurrentWindowMetrics();
                if (wmMetrics != null) {
                    WindowInsets wi = wmMetrics.getWindowInsets();
                    if (wi != null) {
                        Insets ins = wi.getInsetsIgnoringVisibility(
                                WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout());
                        if (ins != null && ins.top > insetTop) {
                            insetTop = ins.top;
                        }
                    }
                }
            } catch (Throwable ignored) {}
        }

        // 2) Проверка через прикреплённый корневой View
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && islandRootContainer != null) {
            try {
                WindowInsets rootWi = islandRootContainer.getRootWindowInsets();
                if (rootWi != null && rootWi.getSystemWindowInsetTop() > insetTop) {
                    insetTop = rootWi.getSystemWindowInsetTop();
                }
            } catch (Throwable ignored) {}
        }

        // 3) Системный ресурс status_bar_height
        try {
            Resources res = context.getResources();
            int resourceId = res.getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                int resPx = res.getDimensionPixelSize(resourceId);
                if (resPx > insetTop) {
                    insetTop = resPx;
                }
            }
        } catch (Throwable ignored) {}

        if (insetTop <= 0) {
            insetTop = Math.round(38f * context.getResources().getDisplayMetrics().density);
        }
        return insetTop;
    }

    private void computeRealMetricsAndScale() {
        DisplayMetrics dm = new DisplayMetrics();
        try {
            if (windowManager != null) {
                Display d = windowManager.getDefaultDisplay();
                if (d != null) {
                    d.getRealMetrics(dm);
                } else {
                    dm.setTo(context.getResources().getDisplayMetrics());
                }
            } else {
                dm.setTo(context.getResources().getDisplayMetrics());
            }
        } catch (Throwable t) {
            dm.setTo(context.getResources().getDisplayMetrics());
        }

        int screenW = dm.widthPixels > 0 ? dm.widthPixels : 1200;
        int screenH = dm.heightPixels > 0 ? dm.heightPixels : 2608;
        int shortSide = Math.min(screenW, screenH);

        int targetPlateW = Math.round(shortSide * 0.906f);
        if (screenW < targetPlateW + dpFallback(16, dm)) {
            targetPlateW = screenW - dpFallback(16, dm);
        }

        float u = targetPlateW / 364.0f;
        int targetPlateH = Math.round(168.0f * u);
        int statusBarH = getRealStatusBarTopInsetPx();
        int targetPlateY = Math.max(statusBarH + Math.round(4.0f * u), Math.round(52.0f * u));

        lastScreenW = screenW;
        lastScreenH = screenH;
        lastDensityDpi = dm.densityDpi;
        unitPx = u;
        expandedPlateW = targetPlateW;
        expandedPlateH = targetPlateH;
        expandedPlateY = targetPlateY;

        // Габариты мини-плашки сохраняем один в один, а по вертикали ставим прямо ПОД строкой состояния!
        collapsedPillW = Math.round(212.0f * u);
        collapsedPillH = Math.round(32.0f * u);
        collapsedPillY = statusBarH + Math.round(2.0f * u);
    }

    private int dpFallback(float dp, DisplayMetrics dm) {
        return Math.round(dp * (dm != null && dm.density > 0 ? dm.density : 3.0f));
    }

    private int U(float units) {
        return Math.max(1, Math.round(units * unitPx));
    }

    private void buildAndAttach() {
        if (windowManager == null || !canDrawOverlay()) return;
        computeRealMetricsAndScale();

        islandRootContainer = new FrameLayout(context) {
            @Override
            public boolean dispatchKeyEvent(KeyEvent event) {
                if (isIslandExpanded && event != null && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                    if (event.getAction() == KeyEvent.ACTION_UP) {
                        setExpanded(false);
                    }
                    return true;
                }
                return super.dispatchKeyEvent(event);
            }

            @Override
            public boolean onTouchEvent(MotionEvent event) {
                if (isIslandExpanded && event != null && event.getActionMasked() == MotionEvent.ACTION_OUTSIDE) {
                    setExpanded(false);
                    return true;
                }
                return super.onTouchEvent(event);
            }
        };
        islandRootContainer.setClipChildren(false);
        islandRootContainer.setClipToPadding(false);

        expandedPlateCard = buildExpandedPlateView();
        collapsedMiniPill = buildCollapsedMiniPillView();

        FrameLayout.LayoutParams expLp = new FrameLayout.LayoutParams(expandedPlateW, expandedPlateH);
        expLp.gravity = Gravity.CENTER;
        islandRootContainer.addView(expandedPlateCard, expLp);

        FrameLayout.LayoutParams colLp = new FrameLayout.LayoutParams(collapsedPillW, collapsedPillH);
        colLp.gravity = Gravity.CENTER;
        islandRootContainer.addView(collapsedMiniPill, colLp);

        int overlayType = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        int flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED;

        islandLayoutParams = new WindowManager.LayoutParams(
                collapsedPillW,
                collapsedPillH,
                overlayType,
                flags,
                PixelFormat.TRANSLUCENT
        );
        islandLayoutParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        islandLayoutParams.x = 0;
        islandLayoutParams.y = collapsedPillY;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            islandLayoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        }
        islandLayoutParams.setTitle("JennyDynamicIslandOverlayV246");

        try {
            windowManager.addView(islandRootContainer, islandLayoutParams);
            isIslandAttached = true;
            applyWindowLayoutState();
            mainHandler.removeCallbacks(progressTickerRunnable);
            mainHandler.postDelayed(progressTickerRunnable, 250L);
        } catch (Throwable t) {
            isIslandAttached = false;
        }
    }

    private LinearLayout buildCollapsedMiniPillView() {
        LinearLayout pill = new LinearLayout(context);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(U(9), U(3), U(8), U(3));

        miniPillBgDrawable = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xF4080B14, 0xF4121829, 0xF4180E2E}
        );
        miniPillBgDrawable.setCornerRadius(U(18));
        miniPillBgDrawable.setStroke(U(1.5f), COLOR_ICON_MUSIC);
        pill.setBackground(miniPillBgDrawable);

        miniPillIconView = new SourceIconView(context, "music", COLOR_ICON_MUSIC, false);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(U(20), U(20));
        pill.addView(miniPillIconView, iconLp);

        miniPillTitleView = new TextView(context);
        miniPillTitleView.setText("Jenny Studio");
        miniPillTitleView.setTextColor(0xFFF0F6FC);
        miniPillTitleView.setTypeface(Typeface.DEFAULT_BOLD);
        miniPillTitleView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        miniPillTitleView.setSingleLine(true);
        miniPillTitleView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        titleLp.leftMargin = U(6);
        titleLp.rightMargin = U(6);
        pill.addView(miniPillTitleView, titleLp);

        miniPillPlayBtn = new TextView(context);
        miniPillPlayBtn.setText("▶");
        miniPillPlayBtn.setTextColor(0xFFD2A8FF);
        miniPillPlayBtn.setTypeface(Typeface.DEFAULT_BOLD);
        miniPillPlayBtn.setGravity(Gravity.CENTER);
        miniPillPlayBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.5f));
        miniPillPlayBtnBg = new GradientDrawable();
        miniPillPlayBtnBg.setColor(0xFF1A1330);
        miniPillPlayBtnBg.setCornerRadius(U(11));
        miniPillPlayBtnBg.setStroke(U(1.1f), COLOR_ICON_MUSIC);
        miniPillPlayBtn.setBackground(miniPillPlayBtnBg);
        LinearLayout.LayoutParams playLp = new LinearLayout.LayoutParams(U(25), U(22));
        miniPillPlayBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isPlaying = !isPlaying;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle','');");
            }
        });
        pill.addView(miniPillPlayBtn, playLp);

        miniPillExpandIcon = new TextView(context);
        miniPillExpandIcon.setText("▼");
        miniPillExpandIcon.setTextColor(0xFFD2A8FF);
        miniPillExpandIcon.setGravity(Gravity.CENTER);
        miniPillExpandIcon.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(10.5f));
        LinearLayout.LayoutParams expIconLp = new LinearLayout.LayoutParams(U(20), U(22));
        expIconLp.leftMargin = U(4);
        pill.addView(miniPillExpandIcon, expIconLp);

        pill.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(true);
            }
        });

        return pill;
    }

    private LinearLayout buildExpandedPlateView() {
        LinearLayout card = new LinearLayout(context);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(U(11), U(8), U(11), U(8));

        plateCardBgDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFA070A12, 0xFA0C111E, 0xFA170D2B}
        );
        plateCardBgDrawable.setCornerRadius(U(32));
        plateCardBgDrawable.setStroke(U(1.9f), COLOR_ICON_MUSIC);
        card.setBackground(plateCardBgDrawable);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setElevation(U(10));
        }

        card.setOnTouchListener(new View.OnTouchListener() {
            private float downY = 0f;
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    downY = event.getRawY();
                } else if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                    float dy = event.getRawY() - downY;
                    if (dy < -U(32)) {
                        setExpanded(false);
                        return true;
                    }
                }
                return false;
            }
        });

        // ---------------------------------------------------------------------
        // РЯД 1: КОМПАКТНЫЕ ЗНАЧКИ ИСТОЧНИКОВ (КАК В ШАПКЕ ПЛЕЕРА) + ИНДИКАТОР МОДУЛЯ + ↗ / ▲
        // ---------------------------------------------------------------------
        LinearLayout rowModes = new LinearLayout(context);
        rowModes.setOrientation(LinearLayout.HORIZONTAL);
        rowModes.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowModesLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(31));
        rowModesLp.bottomMargin = U(5);

        modeBtnMusic = createSourceIconButton("music", COLOR_ICON_MUSIC);
        modeBtnRadio = createSourceIconButton("radio", COLOR_ICON_RADIO);
        modeBtnSoundCloud = createSourceIconButton("soundcloud", COLOR_ICON_SOUNDCLOUD);
        modeBtnYoutube = createSourceIconButton("youtube", COLOR_ICON_YOUTUBE);

        LinearLayout.LayoutParams iconBtnLp1 = new LinearLayout.LayoutParams(U(38), LinearLayout.LayoutParams.MATCH_PARENT);
        iconBtnLp1.rightMargin = U(4.5f);
        LinearLayout.LayoutParams iconBtnLp2 = new LinearLayout.LayoutParams(U(38), LinearLayout.LayoutParams.MATCH_PARENT);
        iconBtnLp2.rightMargin = U(4.5f);
        LinearLayout.LayoutParams iconBtnLp3 = new LinearLayout.LayoutParams(U(38), LinearLayout.LayoutParams.MATCH_PARENT);
        iconBtnLp3.rightMargin = U(4.5f);
        LinearLayout.LayoutParams iconBtnLp4 = new LinearLayout.LayoutParams(U(38), LinearLayout.LayoutParams.MATCH_PARENT);
        iconBtnLp4.rightMargin = U(6.0f);

        rowModes.addView(modeBtnMusic, iconBtnLp1);
        rowModes.addView(modeBtnRadio, iconBtnLp2);
        rowModes.addView(modeBtnSoundCloud, iconBtnLp3);
        rowModes.addView(modeBtnYoutube, iconBtnLp4);

        // Индикатор текущего активного источника (принимает цвет активного значка)
        activeModeBadgeView = new TextView(context);
        activeModeBadgeView.setText("МУЗЫКА • 32-BIT");
        activeModeBadgeView.setGravity(Gravity.CENTER);
        activeModeBadgeView.setSingleLine(true);
        activeModeBadgeView.setEllipsize(TextUtils.TruncateAt.END);
        activeModeBadgeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        activeModeBadgeView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(10.0f));
        activeModeBadgeBg = new GradientDrawable();
        activeModeBadgeBg.setColor(0xFF151126);
        activeModeBadgeBg.setCornerRadius(U(9.5f));
        activeModeBadgeBg.setStroke(U(1.1f), 0xFF4B327A);
        activeModeBadgeView.setBackground(activeModeBadgeBg);
        activeModeBadgeView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f);
        badgeLp.rightMargin = U(5.0f);
        rowModes.addView(activeModeBadgeView, badgeLp);

        // Кнопка перехода в само приложение (↗)
        openAppBtn = new TextView(context);
        openAppBtn.setText("↗");
        openAppBtn.setTypeface(Typeface.DEFAULT_BOLD);
        openAppBtn.setGravity(Gravity.CENTER);
        openAppBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(12.5f));
        openAppBtnBg = new GradientDrawable();
        openAppBtnBg.setColor(0xFF161229);
        openAppBtnBg.setCornerRadius(U(9.5f));
        openAppBtnBg.setStroke(U(1.1f), 0xFF4B327A);
        openAppBtn.setBackground(openAppBtnBg);
        openAppBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams openLp = new LinearLayout.LayoutParams(U(30), LinearLayout.LayoutParams.MATCH_PARENT);
        openLp.rightMargin = U(4.0f);
        rowModes.addView(openAppBtn, openLp);

        // Кнопка сворачивания плашки в мини-капсулу (▲)
        collapseBtn = new TextView(context);
        collapseBtn.setText("▲");
        collapseBtn.setTypeface(Typeface.DEFAULT_BOLD);
        collapseBtn.setGravity(Gravity.CENTER);
        collapseBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        collapseBtnBg = new GradientDrawable();
        collapseBtnBg.setColor(0xFF161229);
        collapseBtnBg.setCornerRadius(U(9.5f));
        collapseBtnBg.setStroke(U(1.1f), 0xFF4B327A);
        collapseBtn.setBackground(collapseBtnBg);
        collapseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(false);
            }
        });
        LinearLayout.LayoutParams colBtnLp = new LinearLayout.LayoutParams(U(30), LinearLayout.LayoutParams.MATCH_PARENT);
        rowModes.addView(collapseBtn, colBtnLp);

        card.addView(rowModes, rowModesLp);

        // ---------------------------------------------------------------------
        // РЯД 2: СТУДИЙНЫЙ ДИСК + НАЗВАНИЕ ТРЕКА/ЭФИРА + КНОПКА «В ИЗБРАННОЕ» (❤️)
        // ---------------------------------------------------------------------
        LinearLayout rowTrack = new LinearLayout(context);
        rowTrack.setOrientation(LinearLayout.HORIZONTAL);
        rowTrack.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTrackLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(45));
        rowTrackLp.bottomMargin = U(4);

        LinearLayout discBox = new LinearLayout(context);
        discBox.setOrientation(LinearLayout.VERTICAL);
        discBox.setGravity(Gravity.CENTER);
        discCircleDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF1A1330, 0xFF120C24}
        );
        discCircleDrawable.setCornerRadius(U(14));
        discCircleDrawable.setStroke(U(1.5f), COLOR_ICON_MUSIC);
        discBox.setBackground(discCircleDrawable);

        discIconView = new SourceIconView(context, "music", COLOR_ICON_MUSIC, false);
        LinearLayout.LayoutParams discIconLp = new LinearLayout.LayoutParams(U(24), U(22));
        discBox.addView(discIconView, discIconLp);

        discBadgeTagView = new TextView(context);
        discBadgeTagView.setText("32-BIT");
        discBadgeTagView.setTextColor(0xFFD2A8FF);
        discBadgeTagView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        discBadgeTagView.setGravity(Gravity.CENTER);
        discBadgeTagView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(7.5f));
        discBox.addView(discBadgeTagView);

        discBox.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams discLp = new LinearLayout.LayoutParams(U(43), U(43));
        discLp.rightMargin = U(9);
        rowTrack.addView(discBox, discLp);

        LinearLayout textCol = new LinearLayout(context);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setGravity(Gravity.CENTER_VERTICAL);

        islandTitleView = new TextView(context);
        islandTitleView.setText(currentTitle);
        islandTitleView.setTextColor(0xFFF0F6FC);
        islandTitleView.setTypeface(Typeface.DEFAULT_BOLD);
        islandTitleView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(14.5f));
        islandTitleView.setSingleLine(true);
        islandTitleView.setEllipsize(TextUtils.TruncateAt.END);
        textCol.addView(islandTitleView);

        islandSubtitleView = new TextView(context);
        islandSubtitleView.setText(currentSubtitle);
        islandSubtitleView.setTextColor(0xFFD2A8FF);
        islandSubtitleView.setTypeface(Typeface.SANS_SERIF, Typeface.NORMAL);
        islandSubtitleView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        islandSubtitleView.setSingleLine(true);
        islandSubtitleView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subLp.topMargin = U(1.5f);
        textCol.addView(islandSubtitleView, subLp);

        textCol.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f);
        textColLp.rightMargin = U(8);
        rowTrack.addView(textCol, textColLp);

        favHeartBtn = new TextView(context);
        favHeartBtn.setText("🤍");
        favHeartBtn.setGravity(Gravity.CENTER);
        favHeartBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(17.5f));
        favHeartBgDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF161C2C, 0xFF1F1632}
        );
        favHeartBgDrawable.setCornerRadius(U(13));
        favHeartBgDrawable.setStroke(U(1.4f), 0xFF4B327A);
        favHeartBtn.setBackground(favHeartBgDrawable);
        favHeartBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isCurrentTrackFav = !isCurrentTrackFav;
                styleFavoriteButton(isCurrentTrackFav);
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('fav','');");
            }
        });
        LinearLayout.LayoutParams favLp = new LinearLayout.LayoutParams(U(43), U(43));
        rowTrack.addView(favHeartBtn, favLp);

        card.addView(rowTrack, rowTrackLp);

        // ---------------------------------------------------------------------
        // РЯД 3: ШКАЛА ПРОГРЕССА С ПЕРЕМОТКОЙ (SEEK) И ТАЙМЕРАМИ
        // ---------------------------------------------------------------------
        LinearLayout rowSeek = new LinearLayout(context);
        rowSeek.setOrientation(LinearLayout.HORIZONTAL);
        rowSeek.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowSeekLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(25));
        rowSeekLp.bottomMargin = U(5);

        elapsedTimeView = new TextView(context);
        elapsedTimeView.setText("0:00");
        elapsedTimeView.setTextColor(0xFFD2A8FF);
        elapsedTimeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        elapsedTimeView.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        elapsedTimeView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        LinearLayout.LayoutParams elLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.WRAP_CONTENT);
        rowSeek.addView(elapsedTimeView, elLp);

        islandSeekBar = new SeekBar(context);
        islandSeekBar.setMax(1000);
        islandSeekBar.setProgress(0);
        islandSeekBar.setPadding(U(8), 0, U(8), 0);
        styleNeonSeekBar(islandSeekBar);
        islandSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && currentDurMs > 0) {
                    long previewMs = (currentDurMs * progress) / 1000L;
                    elapsedTimeView.setText(formatTimeMs(previewMs));
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                isUserSeekingIsland = true;
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                isUserSeekingIsland = false;
                if (currentDurMs > 0) {
                    long targetMs = (currentDurMs * seekBar.getProgress()) / 1000L;
                    currentPosMs = targetMs;
                    lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                    double targetSec = targetMs / 1000.0;
                    MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('seek','" + targetSec + "'); else if(window.seekFromNotification) window.seekFromNotification(" + targetSec + ");");
                }
            }
        });
        LinearLayout.LayoutParams sbLp = new LinearLayout.LayoutParams(0, U(22), 1.0f);
        rowSeek.addView(islandSeekBar, sbLp);

        totalTimeView = new TextView(context);
        totalTimeView.setText("0:00");
        totalTimeView.setTextColor(0xFFA371F7);
        totalTimeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        totalTimeView.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        totalTimeView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        LinearLayout.LayoutParams totLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.WRAP_CONTENT);
        rowSeek.addView(totalTimeView, totLp);

        card.addView(rowSeek, rowSeekLp);

        // ---------------------------------------------------------------------
        // РЯД 4: СТУДИЙНЫЙ ТРАНСПОРТ (⏪ -10с | ⏮ ПРЕД | ▶/⏸ ПУСК | ⏭ СЛЕД | ⏩ +10с)
        // ---------------------------------------------------------------------
        LinearLayout rowTransport = new LinearLayout(context);
        rowTransport.setOrientation(LinearLayout.HORIZONTAL);
        rowTransport.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTransLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(38));

        btnRew10Bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF161229, 0xFF1E1736});
        btnRew10 = createTransportButton("⏪ -10с", false, btnRew10Bg);
        btnRew10.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekRelativeSeconds(-10.0);
            }
        });

        btnPrevBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF161229, 0xFF1E1736});
        btnPrev = createTransportButton("⏮ Пред", false, btnPrevBg);
        btnPrev.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });

        btnPlayPauseBgDrawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF6E38C5, 0xFFA371F7});
        btnPlayPause = createTransportButton("▶ ПУСК", true, btnPlayPauseBgDrawable);
        btnPlayPause.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isPlaying = !isPlaying;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle',''); else if(window.togglePlay) window.togglePlay();");
            }
        });

        btnNextBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF161229, 0xFF1E1736});
        btnNext = createTransportButton("⏭ След", false, btnNextBg);
        btnNext.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });

        btnFwd10Bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF161229, 0xFF1E1736});
        btnFwd10 = createTransportButton("+10с ⏩", false, btnFwd10Bg);
        btnFwd10.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekRelativeSeconds(10.0);
            }
        });

        LinearLayout.LayoutParams trLp1 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.90f);
        trLp1.rightMargin = U(4.5f);
        LinearLayout.LayoutParams trLp2 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.05f);
        trLp2.rightMargin = U(4.5f);
        LinearLayout.LayoutParams trLp3 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.45f);
        trLp3.rightMargin = U(4.5f);
        LinearLayout.LayoutParams trLp4 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.05f);
        trLp4.rightMargin = U(4.5f);
        LinearLayout.LayoutParams trLp5 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.90f);

        rowTransport.addView(btnRew10, trLp1);
        rowTransport.addView(btnPrev, trLp2);
        rowTransport.addView(btnPlayPause, trLp3);
        rowTransport.addView(btnNext, trLp4);
        rowTransport.addView(btnFwd10, trLp5);

        card.addView(rowTransport, rowTransLp);

        return card;
    }

    private SourceIconView createSourceIconButton(final String modeKey, int signatureColor) {
        SourceIconView iv = new SourceIconView(context, modeKey, signatureColor, true);
        iv.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                currentIslandMode = modeKey;
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('mode','" + modeKey + "');");
            }
        });
        return iv;
    }

    private TextView createTransportButton(String label, boolean isPrimary, GradientDrawable bg) {
        TextView tv = new TextView(context);
        tv.setText(label);
        tv.setGravity(Gravity.CENTER);
        tv.setSingleLine(true);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, isPrimary ? U(13.0f) : U(11.2f));
        tv.setTextColor(isPrimary ? 0xFFFFFFFF : 0xFFE6EDF3);

        bg.setCornerRadius(U(12));
        bg.setStroke(U(1.2f), isPrimary ? 0xFFD2A8FF : 0xFF4B327A);
        tv.setBackground(bg);
        return tv;
    }

    private void styleNeonSeekBar(SeekBar sb) {
        int barH = U(6.5f);
        seekBgTrackDrawable = new GradientDrawable();
        seekBgTrackDrawable.setColor(0xFF151C2C);
        seekBgTrackDrawable.setCornerRadius(U(4));
        seekBgTrackDrawable.setStroke(U(1.0f), 0xFF4B327A);
        seekBgTrackDrawable.setSize(-1, barH);

        seekProgGradDrawable = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xFF6E38C5, 0xFFA371F7, 0xFFD2A8FF}
        );
        seekProgGradDrawable.setCornerRadius(U(4));
        seekProgGradDrawable.setSize(-1, barH);
        ClipDrawable progClip = new ClipDrawable(seekProgGradDrawable, Gravity.START, ClipDrawable.HORIZONTAL);

        LayerDrawable layers = new LayerDrawable(new Drawable[]{seekBgTrackDrawable, progClip});
        layers.setId(0, android.R.id.background);
        layers.setId(1, android.R.id.progress);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int padV = U(6.5f);
            layers.setLayerInset(0, 0, padV, 0, padV);
            layers.setLayerInset(1, 0, padV, 0, padV);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            sb.setMinHeight(barH);
            sb.setMaxHeight(barH);
        }
        sb.setSplitTrack(false);
        sb.setProgressDrawable(layers);

        seekThumbDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFFD2A8FF, 0xFFA371F7}
        );
        seekThumbDrawable.setShape(GradientDrawable.OVAL);
        seekThumbDrawable.setSize(U(15), U(15));
        seekThumbDrawable.setStroke(U(2.0f), 0xFFFFFFFF);
        sb.setThumb(seekThumbDrawable);
        sb.setThumbOffset(0);
    }

    private void styleFavoriteButton(boolean isFav, int themeDimBorder, int themeSurfaceTint) {
        if (favHeartBtn == null || favHeartBgDrawable == null) return;
        if (isFav) {
            favHeartBtn.setText("❤️");
            favHeartBgDrawable.setColors(new int[]{0xFF4A1228, 0xFF2E0F24});
            favHeartBgDrawable.setStroke(U(1.5f), 0xFFFF4D79);
        } else {
            favHeartBtn.setText("🤍");
            favHeartBgDrawable.setColors(new int[]{themeSurfaceTint, 0xFF121622});
            favHeartBgDrawable.setStroke(U(1.3f), themeDimBorder);
        }
    }

    private void styleFavoriteButton(boolean isFav) {
        styleFavoriteButton(isFav, 0xFF4B327A, 0xFF1A1330);
    }

    /**
     * Перекрашивает ВЕСЬ интерфейс плашки и мини-капсулы (кроме самих 4 значков источников)
     * в цветовую палитру активного значка источника!
     */
    private void applyFullChameleonTheme(String activeMode) {
        String m = (activeMode != null) ? activeMode.toLowerCase(Locale.ROOT) : "music";

        // Палитра по умолчанию: Музыка (Фиолетовый неон #A371F7)
        int primary = COLOR_ICON_MUSIC;
        int bright = 0xFFD2A8FF;
        int secondary = 0xFF6E38C5;
        int darkTint = 0xFA170D2B;
        int surfaceTint = 0xFF1A1330;
        int dimBorder = 0xFF4B327A;
        String discTag = "32-BIT";
        String modeHeaderTitle = "МУЗЫКА • 32-BIT";

        if ("radio".equals(m)) {
            primary = COLOR_ICON_RADIO;      // #58A6FF Голубой неон
            bright = 0xFF79C0FF;
            secondary = 0xFF1F6FEB;
            darkTint = 0xFA09192E;
            surfaceTint = 0xFF0F1E36;
            dimBorder = 0xFF264F88;
            discTag = "FLAC FM";
            modeHeaderTitle = "РАДИО • ЭФИР";
        } else if ("soundcloud".equals(m)) {
            primary = COLOR_ICON_SOUNDCLOUD; // #FF8C42 Оранжевое облачко
            bright = 0xFFFFB070;
            secondary = 0xFFD9531E;
            darkTint = 0xFA261209;
            surfaceTint = 0xFF2B170E;
            dimBorder = 0xFF7A3E1D;
            discTag = "STREAM";
            modeHeaderTitle = "SOUNDCLOUD";
        } else if ("youtube".equals(m)) {
            primary = COLOR_ICON_YOUTUBE;    // #FF5555 Красный неон YouTube
            bright = 0xFFFF8888;
            secondary = 0xFFB62324;
            darkTint = 0xFA280B12;
            surfaceTint = 0xFF2B1118;
            dimBorder = 0xFF7D2431;
            discTag = "STUB";
            modeHeaderTitle = "YOUTUBE";
        }

        // 1. Четыре значка переключения источников сохраняют свои фирменные цвета,
        //    подсвечивается только активная вкладка
        if (modeBtnMusic != null) modeBtnMusic.updateTabVisualState("music".equals(m));
        if (modeBtnRadio != null) modeBtnRadio.updateTabVisualState("radio".equals(m));
        if (modeBtnSoundCloud != null) modeBtnSoundCloud.updateTabVisualState("soundcloud".equals(m));
        if (modeBtnYoutube != null) modeBtnYoutube.updateTabVisualState("youtube".equals(m));

        // 2. Фон и неоновая рамка большой плашки
        if (plateCardBgDrawable != null) {
            plateCardBgDrawable.setColors(new int[]{0xFA070A12, 0xFA0C111E, darkTint});
            plateCardBgDrawable.setStroke(U(1.9f), primary);
        }

        // 3. Плашка названия активного модуля и кнопки ↗ / ▲ в шапке
        if (activeModeBadgeView != null && activeModeBadgeBg != null) {
            activeModeBadgeView.setText(modeHeaderTitle);
            activeModeBadgeView.setTextColor(bright);
            activeModeBadgeBg.setColor(surfaceTint);
            activeModeBadgeBg.setStroke(U(1.2f), dimBorder);
        }
        if (openAppBtn != null && openAppBtnBg != null) {
            openAppBtn.setTextColor(bright);
            openAppBtnBg.setColor(surfaceTint);
            openAppBtnBg.setStroke(U(1.1f), dimBorder);
        }
        if (collapseBtn != null && collapseBtnBg != null) {
            collapseBtn.setTextColor(bright);
            collapseBtnBg.setColor(surfaceTint);
            collapseBtnBg.setStroke(U(1.1f), dimBorder);
        }

        // 4. Левый студийный диск-индикатор и подзаголовок
        if (discCircleDrawable != null) {
            discCircleDrawable.setColors(new int[]{surfaceTint, darkTint});
            discCircleDrawable.setStroke(U(1.5f), primary);
        }
        updateDynamicDiscAndMiniIcon(m, primary, bright);

        if (discBadgeTagView != null) {
            discBadgeTagView.setText(discTag);
            discBadgeTagView.setTextColor(bright);
        }
        if (islandSubtitleView != null) {
            islandSubtitleView.setTextColor(bright);
        }

        // 5. Кнопка Избранного (❤️ / 🤍)
        styleFavoriteButton(isCurrentTrackFav, dimBorder, surfaceTint);

        // 6. Шкала прогресса (Seek) и таймеры
        if (elapsedTimeView != null) {
            elapsedTimeView.setTextColor(bright);
        }
        if (totalTimeView != null) {
            totalTimeView.setTextColor(primary);
        }
        if (seekBgTrackDrawable != null) {
            seekBgTrackDrawable.setStroke(U(1.0f), dimBorder);
        }
        if (seekProgGradDrawable != null) {
            seekProgGradDrawable.setColors(new int[]{secondary, primary, bright});
        }
        if (seekThumbDrawable != null) {
            seekThumbDrawable.setColors(new int[]{bright, primary});
        }

        // 7. Кнопки транспорта (-10с, Пред, ПУСК/ПАУЗА, След, +10с)
        GradientDrawable[] secBgs = new GradientDrawable[]{btnRew10Bg, btnPrevBg, btnNextBg, btnFwd10Bg};
        for (GradientDrawable g : secBgs) {
            if (g != null) {
                g.setColors(new int[]{surfaceTint, 0xFF121724});
                g.setStroke(U(1.2f), dimBorder);
            }
        }
        TextView[] secBtns = new TextView[]{btnRew10, btnPrev, btnNext, btnFwd10};
        for (TextView b : secBtns) {
            if (b != null) {
                b.setTextColor(0xFFF0F6FC);
            }
        }

        if (btnPlayPause != null && btnPlayPauseBgDrawable != null) {
            btnPlayPause.setText(isPlaying ? "⏸ ПАУЗА" : "▶ ПУСК");
            btnPlayPauseBgDrawable.setColors(isPlaying
                    ? new int[]{secondary, primary}
                    : new int[]{surfaceTint, darkTint});
            btnPlayPauseBgDrawable.setStroke(U(1.5f), isPlaying ? bright : primary);
        }

        // 8. Свёрнутая мини-капсула (полностью принимает цвет активного источника!)
        if (miniPillBgDrawable != null) {
            miniPillBgDrawable.setColors(new int[]{0xF4080B14, surfaceTint, darkTint});
            miniPillBgDrawable.setStroke(U(1.5f), primary);
        }
        if (miniPillPlayBtn != null && miniPillPlayBtnBg != null) {
            miniPillPlayBtn.setText(isPlaying ? "⏸" : "▶");
            miniPillPlayBtn.setTextColor(bright);
            miniPillPlayBtnBg.setColor(surfaceTint);
            miniPillPlayBtnBg.setStroke(U(1.1f), primary);
        }
        if (miniPillExpandIcon != null) {
            miniPillExpandIcon.setTextColor(bright);
        }
    }

    private void updateDynamicDiscAndMiniIcon(String mode, int primary, int bright) {
        if (discIconView != null) {
            discIconView.setSourceTypeAndColor(mode, bright);
        }
        if (miniPillIconView != null) {
            miniPillIconView.setSourceTypeAndColor(mode, primary);
        }
    }

    private void seekRelativeSeconds(double deltaSec) {
        if (currentDurMs <= 0) return;
        long estMs = getEstimatedCurrentPositionMs();
        long targetMs = Math.max(0L, Math.min(currentDurMs, estMs + Math.round(deltaSec * 1000.0)));
        currentPosMs = targetMs;
        lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
        refreshIslandProgressOnly();
        double targetSec = targetMs / 1000.0;
        MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('seek','" + targetSec + "'); else if(window.seekFromNotification) window.seekFromNotification(" + targetSec + ");");
    }

    private long getEstimatedCurrentPositionMs() {
        long base = Math.max(0L, currentPosMs);
        if (isPlaying && lastPosUpdateUptimeMs > 0L) {
            long dt = Math.max(0L, android.os.SystemClock.uptimeMillis() - lastPosUpdateUptimeMs);
            float spd = currentSpeed > 0.05f ? currentSpeed : 1.0f;
            base += Math.round(dt * spd);
        }
        if (currentDurMs > 0L && base > currentDurMs) {
            base = currentDurMs;
        }
        return base;
    }

    private void refreshIslandProgressOnly() {
        if (!isIslandAttached || elapsedTimeView == null || totalTimeView == null || islandSeekBar == null) {
            return;
        }
        if ("youtube".equals(currentIslandMode) && !isPlaying) {
            elapsedTimeView.setText("0:00");
            totalTimeView.setText("СКОРО");
            islandSeekBar.setProgress(0);
            return;
        }
        if ("radio".equals(currentIslandMode) && currentDurMs <= 0L) {
            elapsedTimeView.setText(isPlaying ? "LIVE" : "ПАУЗА");
            totalTimeView.setText("FLAC");
            islandSeekBar.setProgress(isPlaying ? 1000 : 0);
            return;
        }
        long pos = getEstimatedCurrentPositionMs();
        long dur = Math.max(0L, currentDurMs);
        elapsedTimeView.setText(formatTimeMs(pos));
        totalTimeView.setText(dur > 0L ? formatTimeMs(dur) : "0:00");
        if (!isUserSeekingIsland) {
            int prog = (dur > 0L) ? (int) Math.min(1000L, (pos * 1000L) / dur) : 0;
            islandSeekBar.setProgress(prog);
        }
    }

    public void refreshUi() {
        if (!isIslandAttached) return;
        applyFullChameleonTheme(currentIslandMode);

        String displayTitle = currentTitle;
        String displaySub = currentSubtitle;
        if ("youtube".equals(currentIslandMode) && !isPlaying) {
            displayTitle = "▶️ YouTube Studio • Модуль в разработке";
            displaySub = "🚧 Заглушка: скоро прямое воспроизведение YouTube потоков";
        }

        if (islandTitleView != null) {
            islandTitleView.setText(displayTitle);
        }
        if (islandSubtitleView != null) {
            islandSubtitleView.setText(displaySub);
        }
        if (miniPillTitleView != null) {
            miniPillTitleView.setText(displayTitle);
        }
        refreshIslandProgressOnly();
    }

    private void openMainActivityFromIsland() {
        try {
            setExpanded(false);
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(openIntent);
        } catch (Throwable ignored) {}
    }

    private static String formatTimeMs(long ms) {
        if (ms <= 0L) return "0:00";
        long totalSec = ms / 1000L;
        long hrs = totalSec / 3600L;
        long mins = (totalSec % 3600L) / 60L;
        long secs = totalSec % 60L;
        if (hrs > 0L) {
            return String.format(Locale.US, "%d:%02d:%02d", hrs, mins, secs);
        }
        return String.format(Locale.US, "%d:%02d", mins, secs);
    }
}
