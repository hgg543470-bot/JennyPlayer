package com.jenny.player;

import android.content.Context;
import android.content.Intent;
import android.content.res.Resources;
import android.graphics.PixelFormat;
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
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import java.util.Locale;

/**
 * [FIX-ISLAND-OVERLAY] Отдельный контроллер полноразмерной верхней плашки плеера (Dynamic Island Overlay).
 * Отвечает за:
 * - проверку реальных размеров экрана и автоматическое масштабирование всех элементов от DPI (unitPx);
 * - отрисовку развёрнутой плашки (во всю ширину 90.6% короткой стороны экрана, например 1087x502 px) и свёрнутой мини-капсулы;
 * - переключатель между 4 модулями: Музыка (🎵), Радио (📻), SoundCloud (☁️) и YouTube-заглушка (▶️);
 * - кнопку добавления текущего трека в Избранное (❤️ / 🤍);
 * - интерактивную шкалу прогресса с перемоткой (Seek) и кнопки переключения треков.
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
    private boolean isIslandExpanded = true;
    private boolean isUserSeekingIsland = false;

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

    // Виджеты развёрнутой плашки
    private GradientDrawable plateCardBgDrawable;
    private TextView modeBtnMusic;
    private TextView modeBtnRadio;
    private TextView modeBtnSoundCloud;
    private TextView modeBtnYoutube;
    private TextView discEmojiView;
    private TextView discBadgeTagView;
    private GradientDrawable discCircleDrawable;
    private TextView islandTitleView;
    private TextView islandSubtitleView;
    private TextView favHeartBtn;
    private GradientDrawable favHeartBgDrawable;
    private TextView elapsedTimeView;
    private TextView totalTimeView;
    private SeekBar islandSeekBar;
    private TextView btnRew10;
    private TextView btnPrev;
    private TextView btnPlayPause;
    private GradientDrawable btnPlayPauseBgDrawable;
    private TextView btnNext;
    private TextView btnFwd10;

    // Виджеты свёрнутой мини-капсулы
    private TextView miniPillTitleView;
    private TextView miniPillPlayBtn;

    // Текущие реальные метрики экрана и адаптивный шаг масштабирования u
    private int lastScreenW = 0;
    private int lastScreenH = 0;
    private int lastDensityDpi = 0;
    private float unitPx = 3.0f;
    private int expandedPlateW = 1087;
    private int expandedPlateH = 502;
    private int expandedPlateY = 156;
    private int collapsedPillW = 540;
    private int collapsedPillH = 96;
    private int collapsedPillY = 28;

    private final Runnable progressTickerRunnable = new Runnable() {
        @Override
        public void run() {
            if (isIslandAttached && isIslandExpanded && !isUserSeekingIsland) {
                refreshIslandProgressOnly();
            }
            if (isIslandAttached) {
                mainHandler.postDelayed(this, 250L);
            }
        }
    };

    public IslandOverlayController(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
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

    public void setExpanded(final boolean expanded) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                isIslandExpanded = expanded;
                if (!isIslandAttached || islandRootContainer == null || windowManager == null) return;
                computeRealMetricsAndScale();
                expandedPlateCard.setVisibility(expanded ? View.VISIBLE : View.GONE);
                collapsedMiniPill.setVisibility(expanded ? View.GONE : View.VISIBLE);

                islandLayoutParams.width = expanded ? expandedPlateW : collapsedPillW;
                islandLayoutParams.height = expanded ? expandedPlateH : collapsedPillH;
                islandLayoutParams.y = expanded ? expandedPlateY : collapsedPillY;
                try {
                    windowManager.updateViewLayout(islandRootContainer, islandLayoutParams);
                } catch (Throwable ignored) {}
                refreshUi();
            }
        });
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
        destroy();
        buildAndAttach();
        refreshUi();
    }

    public void destroy() {
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

    private int getStatusBarHeightPx() {
        int result = 0;
        try {
            Resources res = context.getResources();
            int resourceId = res.getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                result = res.getDimensionPixelSize(resourceId);
            }
        } catch (Throwable ignored) {}
        if (result <= 0) {
            result = Math.round(38f * context.getResources().getDisplayMetrics().density);
        }
        return result;
    }

    /**
     * Вычисляет реальные физические размеры экрана и DPI-единицу u.
     * На экране 1200x2608 (480 dpi):
     * - shortSide = 1200 px
     * - expandedPlateW = round(1200 * 0.906) = 1087 px (вся ширина плашки Dynamic Island)
     * - unitPx (u) = 1087 / 364 = 2.986 px
     * - expandedPlateH = round(168 * u) = 502 px (вся высота плашки Dynamic Island)
     * - expandedPlateY = max(statusBarH + 4*u, 52*u) = 156 px
     */
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
        int statusBarH = getStatusBarHeightPx();
        int targetPlateY = Math.max(statusBarH + Math.round(4.0f * u), Math.round(52.0f * u));

        lastScreenW = screenW;
        lastScreenH = screenH;
        lastDensityDpi = dm.densityDpi;
        unitPx = u;
        expandedPlateW = targetPlateW;
        expandedPlateH = targetPlateH;
        expandedPlateY = targetPlateY;

        collapsedPillW = Math.round(212.0f * u);
        collapsedPillH = Math.round(32.0f * u);
        collapsedPillY = Math.max(Math.round(4.0f * u), (statusBarH - collapsedPillH) / 2);
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

        islandRootContainer = new FrameLayout(context);
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

        int initW = isIslandExpanded ? expandedPlateW : collapsedPillW;
        int initH = isIslandExpanded ? expandedPlateH : collapsedPillH;
        int initY = isIslandExpanded ? expandedPlateY : collapsedPillY;

        islandLayoutParams = new WindowManager.LayoutParams(
                initW,
                initH,
                overlayType,
                flags,
                PixelFormat.TRANSLUCENT
        );
        islandLayoutParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        islandLayoutParams.x = 0;
        islandLayoutParams.y = initY;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            islandLayoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        }
        islandLayoutParams.setTitle("JennyDynamicIslandOverlayV245");

        expandedPlateCard.setVisibility(isIslandExpanded ? View.VISIBLE : View.GONE);
        collapsedMiniPill.setVisibility(isIslandExpanded ? View.GONE : View.VISIBLE);

        try {
            windowManager.addView(islandRootContainer, islandLayoutParams);
            isIslandAttached = true;
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
        pill.setPadding(U(10), U(3), U(8), U(3));

        GradientDrawable pillBg = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xF2080B14, 0xF2121829, 0xF2180E2E}
        );
        pillBg.setCornerRadius(U(18));
        pillBg.setStroke(U(1.4f), 0xFF7C4DFF);
        pill.setBackground(pillBg);

        TextView dot = new TextView(context);
        dot.setText("🟣");
        dot.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(10.5f));
        pill.addView(dot);

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
        miniPillPlayBtn.setTextColor(0xFF58A6FF);
        miniPillPlayBtn.setTypeface(Typeface.DEFAULT_BOLD);
        miniPillPlayBtn.setGravity(Gravity.CENTER);
        miniPillPlayBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(12.0f));
        GradientDrawable miniBtnBg = new GradientDrawable();
        miniBtnBg.setColor(0xFF17223B);
        miniBtnBg.setCornerRadius(U(11));
        miniBtnBg.setStroke(U(1.0f), 0xFF388BFD);
        miniPillPlayBtn.setBackground(miniBtnBg);
        LinearLayout.LayoutParams playLp = new LinearLayout.LayoutParams(U(24), U(22));
        miniPillPlayBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle','');");
            }
        });
        pill.addView(miniPillPlayBtn, playLp);

        TextView expandIcon = new TextView(context);
        expandIcon.setText("▼");
        expandIcon.setTextColor(0xFFD2A8FF);
        expandIcon.setGravity(Gravity.CENTER);
        expandIcon.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(10.5f));
        LinearLayout.LayoutParams expIconLp = new LinearLayout.LayoutParams(U(20), U(22));
        expIconLp.leftMargin = U(4);
        pill.addView(expandIcon, expIconLp);

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
                new int[]{0xFA070A12, 0xFA0D1322, 0xFA160D2A}
        );
        plateCardBgDrawable.setCornerRadius(U(32));
        plateCardBgDrawable.setStroke(U(1.8f), 0xFF7C4DFF);
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

        // РЯД 1: ПЕРЕКЛЮЧАТЕЛЬ МОДУЛЕЙ (МУЗЫКА / РАДИО / SOUNDCLOUD / YOUTUBE) + КНОПКИ ОКНА
        LinearLayout rowModes = new LinearLayout(context);
        rowModes.setOrientation(LinearLayout.HORIZONTAL);
        rowModes.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowModesLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(31));
        rowModesLp.bottomMargin = U(5);

        modeBtnMusic = createModeTabButton("🎵 Музыка", "music");
        modeBtnRadio = createModeTabButton("📻 Радио", "radio");
        modeBtnSoundCloud = createModeTabButton("☁️ SoundCloud", "soundcloud");
        modeBtnYoutube = createModeTabButton("▶️ YouTube", "youtube");

        LinearLayout.LayoutParams tabLp1 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.00f);
        tabLp1.rightMargin = U(3.0f);
        LinearLayout.LayoutParams tabLp2 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.90f);
        tabLp2.rightMargin = U(3.0f);
        LinearLayout.LayoutParams tabLp3 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.42f);
        tabLp3.rightMargin = U(3.0f);
        LinearLayout.LayoutParams tabLp4 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.08f);
        tabLp4.rightMargin = U(4.0f);

        rowModes.addView(modeBtnMusic, tabLp1);
        rowModes.addView(modeBtnRadio, tabLp2);
        rowModes.addView(modeBtnSoundCloud, tabLp3);
        rowModes.addView(modeBtnYoutube, tabLp4);

        TextView openAppBtn = new TextView(context);
        openAppBtn.setText("↗");
        openAppBtn.setTextColor(0xFF58A6FF);
        openAppBtn.setTypeface(Typeface.DEFAULT_BOLD);
        openAppBtn.setGravity(Gravity.CENTER);
        openAppBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(12.5f));
        GradientDrawable openBg = new GradientDrawable();
        openBg.setColor(0xFF121A2B);
        openBg.setCornerRadius(U(9));
        openBg.setStroke(U(1.1f), 0xFF2F436E);
        openAppBtn.setBackground(openBg);
        openAppBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams openLp = new LinearLayout.LayoutParams(U(27), LinearLayout.LayoutParams.MATCH_PARENT);
        openLp.rightMargin = U(3.5f);
        rowModes.addView(openAppBtn, openLp);

        TextView collapseBtn = new TextView(context);
        collapseBtn.setText("▲");
        collapseBtn.setTextColor(0xFFD2A8FF);
        collapseBtn.setTypeface(Typeface.DEFAULT_BOLD);
        collapseBtn.setGravity(Gravity.CENTER);
        collapseBtn.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        GradientDrawable colBg = new GradientDrawable();
        colBg.setColor(0xFF19132B);
        colBg.setCornerRadius(U(9));
        colBg.setStroke(U(1.1f), 0xFF523588);
        collapseBtn.setBackground(colBg);
        collapseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(false);
            }
        });
        LinearLayout.LayoutParams colBtnLp = new LinearLayout.LayoutParams(U(27), LinearLayout.LayoutParams.MATCH_PARENT);
        rowModes.addView(collapseBtn, colBtnLp);

        card.addView(rowModes, rowModesLp);

        // РЯД 2: СТУДИЙНЫЙ ДИСК + НАЗВАНИЕ ТРЕКА/ЭФИРА + КНОПКА «В ИЗБРАННОЕ» (❤️)
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
                new int[]{0xFF1A1333, 0xFF0F203C}
        );
        discCircleDrawable.setCornerRadius(U(14));
        discCircleDrawable.setStroke(U(1.4f), 0xFF58A6FF);
        discBox.setBackground(discCircleDrawable);

        discEmojiView = new TextView(context);
        discEmojiView.setText("🎵");
        discEmojiView.setGravity(Gravity.CENTER);
        discEmojiView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(15.5f));
        discBox.addView(discEmojiView);

        discBadgeTagView = new TextView(context);
        discBadgeTagView.setText("32-BIT");
        discBadgeTagView.setTextColor(0xFF79C0FF);
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
        islandSubtitleView.setTextColor(0xFF79C0FF);
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
        favHeartBgDrawable.setStroke(U(1.4f), 0xFF3B465E);
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

        // РЯД 3: ШКАЛА ПРОГРЕССА С ПЕРЕМОТКОЙ (SEEK) И ТАЙМЕРАМИ
        LinearLayout rowSeek = new LinearLayout(context);
        rowSeek.setOrientation(LinearLayout.HORIZONTAL);
        rowSeek.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowSeekLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(25));
        rowSeekLp.bottomMargin = U(5);

        elapsedTimeView = new TextView(context);
        elapsedTimeView.setText("0:00");
        elapsedTimeView.setTextColor(0xFF58A6FF);
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
        totalTimeView.setTextColor(0xFF8B949E);
        totalTimeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        totalTimeView.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        totalTimeView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        LinearLayout.LayoutParams totLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.WRAP_CONTENT);
        rowSeek.addView(totalTimeView, totLp);

        card.addView(rowSeek, rowSeekLp);

        // РЯД 4: СТУДИЙНЫЙ ТРАНСПОРТ (⏪ -10с | ⏮ ПРЕД | ▶/⏸ ПУСК | ⏭ СЛЕД | ⏩ +10с)
        LinearLayout rowTransport = new LinearLayout(context);
        rowTransport.setOrientation(LinearLayout.HORIZONTAL);
        rowTransport.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTransLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(38));

        btnRew10 = createTransportButton("⏪ -10с", false);
        btnRew10.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekRelativeSeconds(-10.0);
            }
        });

        btnPrev = createTransportButton("⏮ Пред", false);
        btnPrev.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });

        btnPlayPause = createTransportButton("▶ ПУСК", true);
        btnPlayPause.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isPlaying = !isPlaying;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle',''); else if(window.togglePlay) window.togglePlay();");
            }
        });

        btnNext = createTransportButton("⏭ След", false);
        btnNext.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });

        btnFwd10 = createTransportButton("+10с ⏩", false);
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

    private TextView createModeTabButton(String label, final String modeKey) {
        TextView tv = new TextView(context);
        tv.setText(label);
        tv.setGravity(Gravity.CENTER);
        tv.setSingleLine(true);
        tv.setEllipsize(TextUtils.TruncateAt.END);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(9.6f));
        tv.setPadding(U(2), U(1), U(2), U(1));
        tv.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                currentIslandMode = modeKey;
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('mode','" + modeKey + "');");
            }
        });
        return tv;
    }

    private TextView createTransportButton(String label, boolean isPrimary) {
        TextView tv = new TextView(context);
        tv.setText(label);
        tv.setGravity(Gravity.CENTER);
        tv.setSingleLine(true);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, isPrimary ? U(13.0f) : U(11.2f));
        tv.setTextColor(isPrimary ? 0xFFFFFFFF : 0xFFE6EDF3);

        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                isPrimary
                        ? new int[]{0xFF6E38C5, 0xFF2979FF}
                        : new int[]{0xFF141B29, 0xFF1B2336}
        );
        bg.setCornerRadius(U(12));
        bg.setStroke(U(1.2f), isPrimary ? 0xFF79C0FF : 0xFF303A4E);
        tv.setBackground(bg);
        if (isPrimary) {
            btnPlayPauseBgDrawable = bg;
        }
        return tv;
    }

    private void styleNeonSeekBar(SeekBar sb) {
        int barH = U(6.5f);
        GradientDrawable bgTrack = new GradientDrawable();
        bgTrack.setColor(0xFF1C263B);
        bgTrack.setCornerRadius(U(4));
        bgTrack.setStroke(U(1.0f), 0xFF344568);
        bgTrack.setSize(-1, barH);

        GradientDrawable progGrad = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xFF7C4DFF, 0xFF58A6FF, 0xFF3FB950}
        );
        progGrad.setCornerRadius(U(4));
        progGrad.setSize(-1, barH);
        ClipDrawable progClip = new ClipDrawable(progGrad, Gravity.START, ClipDrawable.HORIZONTAL);

        LayerDrawable layers = new LayerDrawable(new Drawable[]{bgTrack, progClip});
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

        GradientDrawable thumb = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF79C0FF, 0xFFD2A8FF}
        );
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setSize(U(15), U(15));
        thumb.setStroke(U(2.0f), 0xFFFFFFFF);
        sb.setThumb(thumb);
        sb.setThumbOffset(0);
    }

    private void styleFavoriteButton(boolean isFav) {
        if (favHeartBtn == null || favHeartBgDrawable == null) return;
        if (isFav) {
            favHeartBtn.setText("❤️");
            favHeartBgDrawable.setColors(new int[]{0xFF4A1228, 0xFF2E0F24});
            favHeartBgDrawable.setStroke(U(1.5f), 0xFFFF4D79);
        } else {
            favHeartBtn.setText("🤍");
            favHeartBgDrawable.setColors(new int[]{0xFF141B29, 0xFF1B1528});
            favHeartBgDrawable.setStroke(U(1.3f), 0xFF354056);
        }
    }

    private void styleModeButtonsAndTheme(String activeMode) {
        String m = (activeMode != null) ? activeMode.toLowerCase(Locale.ROOT) : "music";
        int accentBorder = 0xFF7C4DFF;
        String discEmoji = "🎵";
        String discTag = "32-BIT";

        if ("radio".equals(m)) {
            accentBorder = 0xFF3FB950;
            discEmoji = "📻";
            discTag = "FLAC FM";
        } else if ("soundcloud".equals(m)) {
            accentBorder = 0xFFFF7B00;
            discEmoji = "☁️";
            discTag = "STREAM";
        } else if ("youtube".equals(m)) {
            accentBorder = 0xFFFF4D6D;
            discEmoji = "▶️";
            discTag = "STUB";
        }

        if (plateCardBgDrawable != null) {
            plateCardBgDrawable.setStroke(U(1.8f), accentBorder);
        }
        if (discCircleDrawable != null) {
            discCircleDrawable.setStroke(U(1.4f), accentBorder);
        }
        if (discEmojiView != null) {
            discEmojiView.setText(discEmoji);
        }
        if (discBadgeTagView != null) {
            discBadgeTagView.setText(discTag);
            discBadgeTagView.setTextColor(accentBorder);
        }

        applySingleModeTabStyle(modeBtnMusic, "music".equals(m), 0xFF7C4DFF, 0xFF2962FF);
        applySingleModeTabStyle(modeBtnRadio, "radio".equals(m), 0xFF2EA043, 0xFF1F6FEB);
        applySingleModeTabStyle(modeBtnSoundCloud, "soundcloud".equals(m), 0xFFFF7B00, 0xFFD9381E);
        applySingleModeTabStyle(modeBtnYoutube, "youtube".equals(m), 0xFFFF3355, 0xFF9E1C40);
    }

    private void applySingleModeTabStyle(TextView tab, boolean active, int c1, int c2) {
        if (tab == null) return;
        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                active ? new int[]{c1, c2} : new int[]{0xFF111726, 0xFF151C2C}
        );
        bg.setCornerRadius(U(9.5f));
        bg.setStroke(U(active ? 1.4f : 1.0f), active ? 0xFFFFFFFF : 0xFF2A3346);
        tab.setBackground(bg);
        tab.setTextColor(active ? 0xFFFFFFFF : 0xFF8B949E);
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
        styleModeButtonsAndTheme(currentIslandMode);
        styleFavoriteButton(isCurrentTrackFav);

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
        if (miniPillPlayBtn != null) {
            miniPillPlayBtn.setText(isPlaying ? "⏸" : "▶");
        }
        if (btnPlayPause != null) {
            btnPlayPause.setText(isPlaying ? "⏸ ПАУЗА" : "▶ ПУСК");
            if (btnPlayPauseBgDrawable != null) {
                btnPlayPauseBgDrawable.setColors(isPlaying
                        ? new int[]{0xFF7C4DFF, 0xFF00B0FF}
                        : new int[]{0xFF283552, 0xFF1A243B});
                btnPlayPauseBgDrawable.setStroke(U(1.4f), isPlaying ? 0xFF79C0FF : 0xFF4A5B82);
            }
        }
        refreshIslandProgressOnly();
    }

    private void openMainActivityFromIsland() {
        try {
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
