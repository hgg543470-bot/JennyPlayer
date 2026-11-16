package com.jenny.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.graphics.BlurMaskFilter;
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
 * [FIX-ISLAND-OVERLAY] Контроллер верхней плашки плеера (Dynamic Island Overlay V248).
 * Реализует:
 * 1. Полное отсутствие рамок/кружков/прямоугольников вокруг всех внутренних кнопок (остаются только чистые векторные значки и широкие зоны тапа).
 * 2. Мягкое размытое свечение (Glow) у главной рамки окна плашки и лёгкое свечение вокруг полосы прогресса.
 * 3. Регулируемую прозрачность фона плашки (0–100%) через ползунок «Настройка плашки» в настройках плеера.
 * 4. В 1-м ряду: 4 значка источников слева, посередине широкая зона тапа с векторным значком стрелочки открытия плеера (вместо надписи «Музыка 32-бит»), справа кнопка сворачивания ▲.
 * 5. Во 2-м ряду: слева (над временем) векторная кнопка Экспорта в .xFLAC (запекает все текущие эффекты плеера с распаковкой в WAV и упаковкой в .xFLAC), по центру бегущая строка названия, справа векторное сердечко Избранного (только для локальных файлов).
 * 6. В 4-м ряду: -10с, Пред (|◀), Пуск/Пауза (▶/⏸), След (▶|), +10с — без жёлтых эмодзи и без рамок.
 * 7. Поддержку обратного хода полосы прогресса при включённом Реверсе в плеере.
 */
public class IslandOverlayController {
    private static final String PREFS_NAME = "jenny_island_prefs";
    private static final String KEY_BG_TRANSPARENCY = "bg_transparency_pct";

    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final SharedPreferences prefs;

    private FrameLayout islandRootContainer;
    private GlowCardLayout expandedPlateCard;
    private GlowCardLayout collapsedMiniPill;
    private WindowManager.LayoutParams islandLayoutParams;
    private boolean isIslandAttached = false;
    private boolean isIslandExpanded = false;
    private boolean isAppInForeground = false;
    private boolean isUserSeekingIsland = false;
    private boolean receiverRegistered = false;

    // Прозрачность фона плашки: 0 = полностью непрозрачная, 100 = полностью прозрачная
    private int bgTransparencyPct = 22;

    // Состояние медиа и модулей
    private String currentTitle = "Jenny Player";
    private String currentSubtitle = "Готов к воспроизведению";
    private boolean isPlaying = false;
    private long currentPosMs = 0L;
    private long currentDurMs = 0L;
    private float currentSpeed = 1.0f;
    private long lastPosUpdateUptimeMs = 0L;
    private boolean isCurrentTrackFav = false;
    private String currentIslandMode = "music"; // "music" | "radio" | "soundcloud" | "youtube"
    private String currentRawTrack = "";

    // Фирменные цвета значков источников
    private static final int COLOR_ICON_MUSIC      = 0xFFA371F7; // Фиолетовый неон
    private static final int COLOR_ICON_RADIO      = 0xFF58A6FF; // Голубой неон
    private static final int COLOR_ICON_SOUNDCLOUD = 0xFFFF8C42; // Оранжевое облачко SoundCloud
    private static final int COLOR_ICON_YOUTUBE    = 0xFFFF5555; // Красный неон YouTube

    // Типы векторных иконок действий
    private static final int ICON_PREV         = 1;
    private static final int ICON_PLAY         = 2;
    private static final int ICON_PAUSE        = 3;
    private static final int ICON_NEXT         = 4;
    private static final int ICON_EXPORT       = 5;
    private static final int ICON_HEART        = 6;
    private static final int ICON_CHEVRON_UP   = 7;
    private static final int ICON_CHEVRON_DOWN = 8;
    private static final int ICON_OPEN_PLAYER  = 9;

    // Виджеты развёрнутой плашки
    private SourceIconView modeBtnMusic;
    private SourceIconView modeBtnRadio;
    private SourceIconView modeBtnSoundCloud;
    private SourceIconView modeBtnYoutube;
    private ActionIconView openAppZoneBtn;
    private ActionIconView collapseBtn;

    private ActionIconView exportTrackBtn;
    private TextView islandTitleView;
    private TextView islandSubtitleView;
    private ActionIconView favHeartBtn;

    private TextView elapsedTimeView;
    private TextView totalTimeView;
    private GlowSeekBar islandSeekBar;
    private GradientDrawable seekBgTrackDrawable;
    private GradientDrawable seekProgGradDrawable;
    private GradientDrawable seekThumbDrawable;

    private TextView btnRew10;
    private ActionIconView btnPrev;
    private ActionIconView btnPlayPause;
    private ActionIconView btnNext;
    private TextView btnFwd10;

    // Виджеты свёрнутой мини-капсулы (5 широких зон без рамок вокруг иконок)
    private SourceIconView miniPillIconView;
    private ActionIconView miniPillPrevBtn;
    private ActionIconView miniPillPlayBtn;
    private ActionIconView miniPillNextBtn;
    private ActionIconView miniPillExpandBtn;

    // Реальные метрики экрана и адаптивный шаг масштабирования u
    private int lastScreenW = 0;
    private int lastScreenH = 0;
    private int lastDensityDpi = 0;
    private float unitPx = 3.0f;
    private int expandedPlateW = 1087;
    private int expandedPlateH = 502;
    private int expandedPlateY = 156;
    private int collapsedPillW = 424;
    private int collapsedPillH = 96;
    private int collapsedPillY = 150;

    private final BroadcastReceiver systemNavigationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (intent == null) return;
            String act = intent.getAction();
            if (Intent.ACTION_CLOSE_SYSTEM_DIALOGS.equals(act) || Intent.ACTION_SCREEN_OFF.equals(act)) {
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
     * Контейнер плашки/мини-капсулы с настраиваемой прозрачностью фона (0–100%)
     * и мягкой, слегка размытой светящейся внешней рамкой (Glow) вместо резкой линии.
     */
    private final class GlowCardLayout extends LinearLayout {
        private final float cornerRadiusPx;
        private int glowColor = COLOR_ICON_MUSIC;
        private int baseBgColor = 0x090C15;
        private int tintBgColor = 0x160D28;
        private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glowBlurPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint featherPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF cardRect = new RectF();

        GlowCardLayout(Context ctx, float cornerRadiusPx) {
            super(ctx);
            this.cornerRadiusPx = cornerRadiusPx;
            setWillNotDraw(false);

            bgPaint.setStyle(Paint.Style.FILL);
            glowBlurPaint.setStyle(Paint.Style.STROKE);
            try {
                glowBlurPaint.setMaskFilter(new BlurMaskFilter(U(4.5f), BlurMaskFilter.Blur.NORMAL));
            } catch (Throwable ignored) {}

            featherPaint.setStyle(Paint.Style.STROKE);
        }

        void setColorsAndInvalidate(int glowCol, int tintCol) {
            this.glowColor = glowCol;
            this.tintBgColor = tintCol & 0x00FFFFFF;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) {
                super.onDraw(canvas);
                return;
            }

            float inset = U(4.2f);
            cardRect.set(inset, inset, w - inset, h - inset);

            // Прозрачность фона: 0% -> alpha=245 (почти непрозрачный), 100% -> alpha=0 (полностью прозрачный)
            int clampedTrans = Math.max(0, Math.min(100, bgTransparencyPct));
            int bgAlpha = Math.round(((100 - clampedTrans) * 245.0f) / 100.0f);
            if (bgAlpha > 0) {
                // Смешиваем тёмно-студийную базу с лёгким оттенком активного источника
                int r = (((baseBgColor >> 16) & 0xFF) * 65 + ((tintBgColor >> 16) & 0xFF) * 35) / 100;
                int g = (((baseBgColor >> 8) & 0xFF) * 65 + ((tintBgColor >> 8) & 0xFF) * 35) / 100;
                int b = ((baseBgColor & 0xFF) * 65 + (tintBgColor & 0xFF) * 35) / 100;
                bgPaint.setColor((bgAlpha << 24) | (r << 16) | (g << 8) | b);
                canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, bgPaint);
            }

            int rgb = glowColor & 0x00FFFFFF;

            // Мягкий размытый ореол главной рамки (не резкая линия, а плавное свечение)
            glowBlurPaint.setColor((0x44 << 24) | rgb);
            glowBlurPaint.setStrokeWidth(U(5.5f));
            canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, glowBlurPaint);

            featherPaint.setColor((0x18 << 24) | rgb);
            featherPaint.setStrokeWidth(U(6.8f));
            canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, featherPaint);

            featherPaint.setColor((0x2C << 24) | rgb);
            featherPaint.setStrokeWidth(U(4.4f));
            canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, featherPaint);

            featherPaint.setColor((0x52 << 24) | rgb);
            featherPaint.setStrokeWidth(U(2.5f));
            canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, featherPaint);

            featherPaint.setColor((0x98 << 24) | rgb);
            featherPaint.setStrokeWidth(U(1.2f));
            canvas.drawRoundRect(cardRect, cornerRadiusPx, cornerRadiusPx, featherPaint);

            super.onDraw(canvas);
        }
    }

    /**
     * Полоса прогресса (SeekBar) со слабым мягким свечением на несколько пикселей вокруг самой полосы.
     */
    private final class GlowSeekBar extends SeekBar {
        private int glowColor = COLOR_ICON_MUSIC;
        private final Paint haloPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint activeHaloPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF trackRect = new RectF();
        private final RectF fillRect = new RectF();

        GlowSeekBar(Context ctx) {
            super(ctx);
            haloPaint.setStyle(Paint.Style.STROKE);
            activeHaloPaint.setStyle(Paint.Style.FILL);
            try {
                haloPaint.setMaskFilter(new BlurMaskFilter(U(3.2f), BlurMaskFilter.Blur.NORMAL));
                activeHaloPaint.setMaskFilter(new BlurMaskFilter(U(3.8f), BlurMaskFilter.Blur.NORMAL));
            } catch (Throwable ignored) {}
        }

        void setGlowColor(int color) {
            this.glowColor = color;
            invalidate();
        }

        @Override
        protected synchronized void onDraw(Canvas canvas) {
            int w = getWidth();
            int h = getHeight();
            if (w > 0 && h > 0) {
                float padL = getPaddingLeft();
                float padR = getPaddingRight();
                float barH = U(6.5f);
                float top = (h - barH) * 0.5f;
                float bot = top + barH;
                float r = U(4.0f);
                int rgb = glowColor & 0x00FFFFFF;

                trackRect.set(padL, top, w - padR, bot);
                // Лёгкое свечение на несколько пикселей вокруг всей полосы прогресса
                haloPaint.setColor((0x30 << 24) | rgb);
                haloPaint.setStrokeWidth(U(4.2f));
                canvas.drawRoundRect(trackRect, r, r, haloPaint);

                haloPaint.setColor((0x50 << 24) | rgb);
                haloPaint.setStrokeWidth(U(2.0f));
                canvas.drawRoundRect(trackRect, r, r, haloPaint);

                int max = getMax();
                int prog = getProgress();
                if (max > 0 && prog > 0) {
                    float fillW = (trackRect.width() * prog) / (float) max;
                    fillRect.set(padL, top - U(1.2f), padL + fillW, bot + U(1.2f));
                    activeHaloPaint.setColor((0x38 << 24) | rgb);
                    canvas.drawRoundRect(fillRect, r, r, activeHaloPaint);
                }
            }
            super.onDraw(canvas);
        }
    }

    /**
     * Кастомный векторный значок источника БЕЗ рамок вокруг кнопки (только чистая иконка и мягкий индикатор активности).
     */
    private final class SourceIconView extends View {
        private String sourceType;
        private int iconColor;
        private boolean isSelectedTab = false;
        private final boolean isTabButton;
        private final float iconScaleRatio;
        private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glowDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rectF = new RectF();

        SourceIconView(Context ctx, String sourceType, int defaultColor, boolean isTabButton, float iconScaleRatio) {
            super(ctx);
            this.sourceType = sourceType;
            this.iconColor = defaultColor;
            this.isTabButton = isTabButton;
            this.iconScaleRatio = iconScaleRatio;

            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeCap(Paint.Cap.ROUND);
            strokePaint.setStrokeJoin(Paint.Join.ROUND);

            fillPaint.setStyle(Paint.Style.FILL);
            glowDotPaint.setStyle(Paint.Style.FILL);
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
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return;

            float scaleBoost = (isTabButton && isSelectedTab) ? 1.12f : 1.0f;
            float size = Math.min(w, h) * iconScaleRatio * scaleBoost;
            float ox = (w - size) * 0.5f;
            float oy = (h - size) * 0.5f - (isTabButton ? U(1.2f) : 0f);
            float s = size / 24.0f;

            int alpha = (!isTabButton || isSelectedTab) ? 0xFF : 0xB8;
            int drawCol = (alpha << 24) | (iconColor & 0x00FFFFFF);

            strokePaint.setColor(drawCol);
            strokePaint.setStrokeWidth(Math.max(2.0f, (isSelectedTab ? 2.25f : 1.95f) * s));
            fillPaint.setColor(drawCol);

            if (isTabButton && isSelectedTab) {
                // Мягкое подсвечивание снизу под активным значком (без рамок вокруг кнопки!)
                glowDotPaint.setColor((0x30 << 24) | (iconColor & 0x00FFFFFF));
                canvas.drawCircle(w * 0.5f, h * 0.5f, size * 0.62f, glowDotPaint);
                glowDotPaint.setColor(iconColor);
                rectF.set(w * 0.5f - U(6.0f), h - U(2.4f), w * 0.5f + U(6.0f), h - U(0.8f));
                canvas.drawRoundRect(rectF, U(1.0f), U(1.0f), glowDotPaint);
            }

            if ("soundcloud".equals(sourceType)) {
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
                rectF.set(ox + 3.2f * s, oy + 6.8f * s, ox + 17.2f * s, oy + 20.8f * s);
                canvas.drawArc(rectF, 45f, 180f, true, strokePaint);
                canvas.drawLine(ox + 9.2f * s, oy + 15.2f * s, ox + 14.2f * s, oy + 10.2f * s, strokePaint);
                canvas.drawCircle(ox + 14.8f * s, oy + 9.6f * s, 1.4f * s, fillPaint);

                rectF.set(ox + 11.0f * s, oy + 5.8f * s, ox + 18.2f * s, oy + 13.0f * s);
                canvas.drawArc(rectF, -80f, 75f, false, strokePaint);
                rectF.set(ox + 9.0f * s, oy + 3.2f * s, ox + 20.8f * s, oy + 15.0f * s);
                canvas.drawArc(rectF, -80f, 75f, false, strokePaint);

                path.reset();
                path.moveTo(ox + 4.8f * s, oy + 21.0f * s);
                path.lineTo(ox + 8.0f * s, oy + 17.2f * s);
                path.lineTo(ox + 11.2f * s, oy + 21.0f * s);
                path.close();
                canvas.drawPath(path, strokePaint);
            } else if ("youtube".equals(sourceType)) {
                rectF.set(ox + 2.2f * s, oy + 4.8f * s, ox + 21.8f * s, oy + 19.2f * s);
                canvas.drawRoundRect(rectF, 4.2f * s, 4.2f * s, strokePaint);

                path.reset();
                path.moveTo(ox + 9.8f * s, oy + 8.8f * s);
                path.lineTo(ox + 15.8f * s, oy + 12.0f * s);
                path.lineTo(ox + 9.8f * s, oy + 15.2f * s);
                path.close();
                canvas.drawPath(path, fillPaint);
            } else {
                canvas.drawCircle(ox + 6.5f * s, oy + 17.5f * s, 2.5f * s, fillPaint);
                canvas.drawCircle(ox + 16.5f * s, oy + 15.5f * s, 2.5f * s, fillPaint);
                canvas.drawLine(ox + 8.8f * s, oy + 17.5f * s, ox + 8.8f * s, oy + 6.2f * s, strokePaint);
                canvas.drawLine(ox + 18.8f * s, oy + 15.5f * s, ox + 18.8f * s, oy + 4.2f * s, strokePaint);
                canvas.drawLine(ox + 8.8f * s, oy + 6.2f * s, ox + 18.8f * s, oy + 4.2f * s, strokePaint);
                canvas.drawLine(ox + 8.8f * s, oy + 9.4f * s, ox + 18.8f * s, oy + 7.4f * s, strokePaint);
            }
        }
    }

    /**
     * Чистые векторные иконки действий БЕЗ рамок вокруг кнопок:
     * Prev (|◀), Play (▶), Pause (⏸), Next (▶|), Export (стрелка вверх из лотка), Heart (Избранное),
     * Open Player (стрелочка разворота в проигрыватель), Chevrons (▲/▼).
     */
    private final class ActionIconView extends View {
        private int iconType;
        private int iconColor;
        private boolean isFilledState = false;
        private final float iconRatio;
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rectF = new RectF();

        ActionIconView(Context ctx, int iconType, int iconColor, float iconRatio) {
            super(ctx);
            this.iconType = iconType;
            this.iconColor = iconColor;
            this.iconRatio = iconRatio;

            fillPaint.setStyle(Paint.Style.FILL);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeCap(Paint.Cap.ROUND);
            strokePaint.setStrokeJoin(Paint.Join.ROUND);
        }

        void setIconType(int newType) {
            if (this.iconType != newType) {
                this.iconType = newType;
                invalidate();
            }
        }

        void setIconColor(int newColor) {
            if (this.iconColor != newColor) {
                this.iconColor = newColor;
                invalidate();
            }
        }

        void setFilledState(boolean filled) {
            if (this.isFilledState != filled) {
                this.isFilledState = filled;
                invalidate();
            }
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return;

            float size = Math.min(w, h) * iconRatio;
            float ox = (w - size) * 0.5f;
            float oy = (h - size) * 0.5f;
            float s = size / 24.0f;

            fillPaint.setColor(iconColor);
            strokePaint.setColor(iconColor);
            strokePaint.setStrokeWidth(Math.max(2.0f, 2.15f * s));

            if (iconType == ICON_PREV) {
                // Точная копия #btnPrev: <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                rectF.set(ox + 5.6f * s, oy + 5.8f * s, ox + 8.0f * s, oy + 18.2f * s);
                canvas.drawRoundRect(rectF, 0.8f * s, 0.8f * s, fillPaint);

                path.reset();
                path.moveTo(ox + 9.6f * s, oy + 12.0f * s);
                path.lineTo(ox + 18.4f * s, oy + 18.2f * s);
                path.lineTo(ox + 18.4f * s, oy + 5.8f * s);
                path.close();
                canvas.drawPath(path, fillPaint);
            } else if (iconType == ICON_NEXT) {
                // Точная копия #btnNext: <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                path.reset();
                path.moveTo(ox + 5.6f * s, oy + 18.2f * s);
                path.lineTo(ox + 14.4f * s, oy + 12.0f * s);
                path.lineTo(ox + 5.6f * s, oy + 5.8f * s);
                path.close();
                canvas.drawPath(path, fillPaint);

                rectF.set(ox + 16.0f * s, oy + 5.8f * s, ox + 18.4f * s, oy + 18.2f * s);
                canvas.drawRoundRect(rectF, 0.8f * s, 0.8f * s, fillPaint);
            } else if (iconType == ICON_PLAY) {
                // Точная копия #playPauseBtn (Play): <path d="M8 5v14l11-7z"/>
                path.reset();
                path.moveTo(ox + 7.6f * s, oy + 4.8f * s);
                path.lineTo(ox + 7.6f * s, oy + 19.2f * s);
                path.lineTo(ox + 19.2f * s, oy + 12.0f * s);
                path.close();
                canvas.drawPath(path, fillPaint);
            } else if (iconType == ICON_PAUSE) {
                // Точная копия #playPauseBtn (Pause): <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                rectF.set(ox + 6.0f * s, oy + 5.0f * s, ox + 10.2f * s, oy + 19.0f * s);
                canvas.drawRoundRect(rectF, 1.1f * s, 1.1f * s, fillPaint);
                rectF.set(ox + 13.8f * s, oy + 5.0f * s, ox + 18.0f * s, oy + 19.0f * s);
                canvas.drawRoundRect(rectF, 1.1f * s, 1.1f * s, fillPaint);
            } else if (iconType == ICON_EXPORT) {
                // Точная копия #btnExport: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                path.reset();
                path.moveTo(ox + 3.2f * s, oy + 14.8f * s);
                path.lineTo(ox + 3.2f * s, oy + 18.8f * s);
                rectF.set(ox + 3.2f * s, oy + 16.8f * s, ox + 7.2f * s, oy + 20.8f * s);
                path.arcTo(rectF, 180f, -90f, false);
                path.lineTo(ox + 18.8f * s, oy + 20.8f * s);
                rectF.set(ox + 16.8f * s, oy + 16.8f * s, ox + 20.8f * s, oy + 20.8f * s);
                path.arcTo(rectF, 90f, -90f, false);
                path.lineTo(ox + 20.8f * s, oy + 14.8f * s);
                canvas.drawPath(path, strokePaint);

                path.reset();
                path.moveTo(ox + 7.0f * s, oy + 8.2f * s);
                path.lineTo(ox + 12.0f * s, oy + 3.2f * s);
                path.lineTo(ox + 17.0f * s, oy + 8.2f * s);
                canvas.drawPath(path, strokePaint);

                canvas.drawLine(ox + 12.0f * s, oy + 3.4f * s, ox + 12.0f * s, oy + 15.2f * s, strokePaint);
            } else if (iconType == ICON_HEART) {
                // Точная копия сердечка Избранного (#btn-favModal)
                path.reset();
                path.moveTo(ox + 12.0f * s, oy + 20.8f * s);
                path.cubicTo(ox + 3.0f * s, oy + 14.2f * s, ox + 1.6f * s, oy + 8.2f * s, ox + 5.2f * s, oy + 5.0f * s);
                path.cubicTo(ox + 7.8f * s, oy + 2.8f * s, ox + 10.6f * s, oy + 4.0f * s, ox + 12.0f * s, oy + 6.4f * s);
                path.cubicTo(ox + 13.4f * s, oy + 4.0f * s, ox + 16.2f * s, oy + 2.8f * s, ox + 18.8f * s, oy + 5.0f * s);
                path.cubicTo(ox + 22.4f * s, oy + 8.2f * s, ox + 21.0f * s, oy + 14.2f * s, ox + 12.0f * s, oy + 20.8f * s);
                path.close();
                if (isFilledState) {
                    canvas.drawPath(path, fillPaint);
                }
                canvas.drawPath(path, strokePaint);
            } else if (iconType == ICON_OPEN_PLAYER) {
                // Векторный значок со стрелочкой разворота в проигрыватель (посередине верхней строки)
                path.reset();
                path.moveTo(ox + 13.5f * s, oy + 5.0f * s);
                path.lineTo(ox + 19.5f * s, oy + 5.0f * s);
                path.lineTo(ox + 19.5f * s, oy + 11.0f * s);
                canvas.drawPath(path, strokePaint);

                canvas.drawLine(ox + 10.0f * s, oy + 14.5f * s, ox + 19.2f * s, oy + 5.3f * s, strokePaint);

                path.reset();
                path.moveTo(ox + 19.0f * s, oy + 14.2f * s);
                path.lineTo(ox + 19.0f * s, oy + 17.5f * s);
                rectF.set(ox + 15.0f * s, oy + 15.5f * s, ox + 19.0f * s, oy + 19.5f * s);
                path.arcTo(rectF, 0f, 90f, false);
                path.lineTo(ox + 6.5f * s, oy + 19.5f * s);
                rectF.set(ox + 4.5f * s, oy + 15.5f * s, ox + 8.5f * s, oy + 19.5f * s);
                path.arcTo(rectF, 90f, 90f, false);
                path.lineTo(ox + 4.5f * s, oy + 7.5f * s);
                rectF.set(ox + 4.5f * s, oy + 5.5f * s, ox + 8.5f * s, oy + 9.5f * s);
                path.arcTo(rectF, 180f, 90f, false);
                path.lineTo(ox + 10.2f * s, oy + 5.5f * s);
                canvas.drawPath(path, strokePaint);
            } else if (iconType == ICON_CHEVRON_UP) {
                path.reset();
                path.moveTo(ox + 5.5f * s, oy + 15.2f * s);
                path.lineTo(ox + 12.0f * s, oy + 8.6f * s);
                path.lineTo(ox + 18.5f * s, oy + 15.2f * s);
                canvas.drawPath(path, strokePaint);
            } else if (iconType == ICON_CHEVRON_DOWN) {
                path.reset();
                path.moveTo(ox + 5.5f * s, oy + 8.8f * s);
                path.lineTo(ox + 12.0f * s, oy + 15.4f * s);
                path.lineTo(ox + 18.5f * s, oy + 8.8f * s);
                canvas.drawPath(path, strokePaint);
            }
        }
    }

    public IslandOverlayController(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
        this.prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.bgTransparencyPct = Math.max(0, Math.min(100, this.prefs.getInt(KEY_BG_TRANSPARENCY, 22)));
        registerNavigationReceiver();
    }

    public void setBgTransparencyPct(final int transparencyPct) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                int clean = Math.max(0, Math.min(100, transparencyPct));
                bgTransparencyPct = clean;
                try {
                    prefs.edit().putInt(KEY_BG_TRANSPARENCY, clean).apply();
                } catch (Throwable ignored) {}
                if (expandedPlateCard != null) expandedPlateCard.invalidate();
                if (collapsedMiniPill != null) collapsedMiniPill.invalidate();
            }
        });
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

    public void setAppInForeground(final boolean inForeground) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                boolean changed = (isAppInForeground != inForeground);
                isAppInForeground = inForeground;
                if (inForeground) {
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
            if (islandTitleView != null) {
                islandTitleView.setSelected(true);
            }
        } else {
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

    private int getRealStatusBarTopInsetPx() {
        int insetTop = 0;

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && islandRootContainer != null) {
            try {
                WindowInsets rootWi = islandRootContainer.getRootWindowInsets();
                if (rootWi != null && rootWi.getSystemWindowInsetTop() > insetTop) {
                    insetTop = rootWi.getSystemWindowInsetTop();
                }
            } catch (Throwable ignored) {}
        }

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

        collapsedPillW = Math.round(142.0f * u);
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
        islandLayoutParams.setTitle("JennyDynamicIslandOverlayV248");

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

    /**
     * Свёрнутая мини-плашка: 5 широких зон нажатия во всю высоту планки, без внутренних рамок.
     */
    private GlowCardLayout buildCollapsedMiniPillView() {
        GlowCardLayout pill = new GlowCardLayout(context, U(18));
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(U(6), U(4), U(6), U(4));

        // 1) Значок мелодии/источника -> открывает сам Jenny Player
        miniPillIconView = new SourceIconView(context, "music", COLOR_ICON_MUSIC, false, 0.62f);
        miniPillIconView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        pill.addView(miniPillIconView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // 2) Предыдущий (|◀)
        miniPillPrevBtn = new ActionIconView(context, ICON_PREV, 0xFFD2A8FF, 0.56f);
        miniPillPrevBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });
        pill.addView(miniPillPrevBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // 3) Плей / Пауза (▶ / ⏸)
        miniPillPlayBtn = new ActionIconView(context, ICON_PLAY, 0xFFFFFFFF, 0.64f);
        miniPillPlayBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isPlaying = !isPlaying;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle',''); else if(window.togglePlay) window.togglePlay();");
            }
        });
        pill.addView(miniPillPlayBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // 4) Следующий (▶|)
        miniPillNextBtn = new ActionIconView(context, ICON_NEXT, 0xFFD2A8FF, 0.56f);
        miniPillNextBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });
        pill.addView(miniPillNextBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // 5) Разворот в большую плашку (▼)
        miniPillExpandBtn = new ActionIconView(context, ICON_CHEVRON_DOWN, 0xFFD2A8FF, 0.52f);
        miniPillExpandBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(true);
            }
        });
        pill.addView(miniPillExpandBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        return pill;
    }

    private GlowCardLayout buildExpandedPlateView() {
        GlowCardLayout card = new GlowCardLayout(context, U(30));
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(U(13), U(9), U(13), U(9));

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
        // РЯД 1: 4 ЧИСТЫХ ЗНАЧКА ИСТОЧНИКОВ СЛЕВА + ШИРОКАЯ ЗОНА РАЗВОРОТА В ПЛЕЕР ПОСЕРЕДИНЕ + СВЕРНУТЬ ▲ СПРАВА
        // ---------------------------------------------------------------------
        LinearLayout rowModes = new LinearLayout(context);
        rowModes.setOrientation(LinearLayout.HORIZONTAL);
        rowModes.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowModesLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(31));
        rowModesLp.bottomMargin = U(4);

        modeBtnMusic = createSourceIconButton("music", COLOR_ICON_MUSIC);
        modeBtnRadio = createSourceIconButton("radio", COLOR_ICON_RADIO);
        modeBtnSoundCloud = createSourceIconButton("soundcloud", COLOR_ICON_SOUNDCLOUD);
        modeBtnYoutube = createSourceIconButton("youtube", COLOR_ICON_YOUTUBE);

        rowModes.addView(modeBtnMusic, new LinearLayout.LayoutParams(U(40), LinearLayout.LayoutParams.MATCH_PARENT));
        rowModes.addView(modeBtnRadio, new LinearLayout.LayoutParams(U(40), LinearLayout.LayoutParams.MATCH_PARENT));
        rowModes.addView(modeBtnSoundCloud, new LinearLayout.LayoutParams(U(40), LinearLayout.LayoutParams.MATCH_PARENT));
        rowModes.addView(modeBtnYoutube, new LinearLayout.LayoutParams(U(40), LinearLayout.LayoutParams.MATCH_PARENT));

        // Посередине (вместо надписи «Музыка 32-бит»): векторный значок со стрелочкой открытия проигрывателя,
        // а вся центральная пустая область является широкой зоной тапа для входа в приложение!
        openAppZoneBtn = new ActionIconView(context, ICON_OPEN_PLAYER, 0xFFD2A8FF, 0.56f);
        openAppZoneBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        rowModes.addView(openAppZoneBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // Справа на своём месте: кнопка сворачивания в маленькую плашку (▲), без рамки
        collapseBtn = new ActionIconView(context, ICON_CHEVRON_UP, 0xFFD2A8FF, 0.58f);
        collapseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(false);
            }
        });
        rowModes.addView(collapseBtn, new LinearLayout.LayoutParams(U(38), LinearLayout.LayoutParams.MATCH_PARENT));

        card.addView(rowModes, rowModesLp);

        // ---------------------------------------------------------------------
        // РЯД 2: КНОПКА ЭКСПОРТА В .XFLAC СЛЕВА (НАД ВРЕМЕНЕМ) + БЕГУЩАЯ СТРОКА НАЗВАНИЯ + ИЗБРАННОЕ СПРАВА
        // ---------------------------------------------------------------------
        LinearLayout rowTrack = new LinearLayout(context);
        rowTrack.setOrientation(LinearLayout.HORIZONTAL);
        rowTrack.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTrackLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(44));
        rowTrackLp.bottomMargin = U(4);

        // Слева (где было 32-BIT, прямо над левым таймером): чистая векторная кнопка Экспорта в .xFLAC (без рамки!)
        exportTrackBtn = new ActionIconView(context, ICON_EXPORT, 0xFFD2A8FF, 0.54f);
        exportTrackBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!"music".equals(currentIslandMode)) return;
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('export_xflac','');");
            }
        });
        LinearLayout.LayoutParams expBtnLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.MATCH_PARENT);
        expBtnLp.rightMargin = U(6);
        rowTrack.addView(exportTrackBtn, expBtnLp);

        LinearLayout textCol = new LinearLayout(context);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setGravity(Gravity.CENTER_VERTICAL);

        // Бегущая строка (Marquee) без обрезания троеточием и без жёлтых эмодзи
        islandTitleView = new TextView(context) {
            @Override
            public boolean isFocused() {
                return true;
            }
        };
        islandTitleView.setText(currentTitle);
        islandTitleView.setTextColor(0xFFF0F6FC);
        islandTitleView.setTypeface(Typeface.DEFAULT_BOLD);
        islandTitleView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(14.5f));
        islandTitleView.setSingleLine(true);
        islandTitleView.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        islandTitleView.setMarqueeRepeatLimit(-1);
        islandTitleView.setHorizontallyScrolling(true);
        islandTitleView.setHorizontalFadingEdgeEnabled(true);
        islandTitleView.setSelected(true);
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
        textColLp.rightMargin = U(6);
        rowTrack.addView(textCol, textColLp);

        // Справа: чистая векторная кнопка Избранного (работает только на локальные файлы в фиолетовой плашке)
        favHeartBtn = new ActionIconView(context, ICON_HEART, 0xFFD2A8FF, 0.54f);
        favHeartBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!"music".equals(currentIslandMode)) return;
                isCurrentTrackFav = !isCurrentTrackFav;
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('fav','');");
            }
        });
        LinearLayout.LayoutParams favLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.MATCH_PARENT);
        rowTrack.addView(favHeartBtn, favLp);

        card.addView(rowTrack, rowTrackLp);

        // ---------------------------------------------------------------------
        // РЯД 3: ШКАЛА ПРОГРЕССА С ЛЁГКИМ СВЕЧЕНИЕМ ВОКРУГ ПОЛОСЫ И ТАЙМЕРАМИ
        // ---------------------------------------------------------------------
        LinearLayout rowSeek = new LinearLayout(context);
        rowSeek.setOrientation(LinearLayout.HORIZONTAL);
        rowSeek.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowSeekLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(26));
        rowSeekLp.bottomMargin = U(4);

        elapsedTimeView = new TextView(context);
        elapsedTimeView.setText("0:00");
        elapsedTimeView.setTextColor(0xFFD2A8FF);
        elapsedTimeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        elapsedTimeView.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        elapsedTimeView.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(11.0f));
        LinearLayout.LayoutParams elLp = new LinearLayout.LayoutParams(U(42), LinearLayout.LayoutParams.WRAP_CONTENT);
        rowSeek.addView(elapsedTimeView, elLp);

        islandSeekBar = new GlowSeekBar(context);
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
        LinearLayout.LayoutParams sbLp = new LinearLayout.LayoutParams(0, U(24), 1.0f);
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
        // РЯД 4: ТРАНСПОРТ БЕЗ РАМОК И БЕЗ ЖЁЛТЫХ ЭМОДЗИ (-10с | |◀ | ▶/⏸ | ▶| | +10с)
        // ---------------------------------------------------------------------
        LinearLayout rowTransport = new LinearLayout(context);
        rowTransport.setOrientation(LinearLayout.HORIZONTAL);
        rowTransport.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTransLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(38));

        // Чисто текст «-10с» без жёлтых значков и без рамки
        btnRew10 = createBorderlessStepButton("-10с");
        btnRew10.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekRelativeSeconds(-10.0);
            }
        });

        // Чистая векторная иконка Предыдущий (|◀) из плеера без кружка/квадрата
        btnPrev = new ActionIconView(context, ICON_PREV, 0xFFD2A8FF, 0.58f);
        btnPrev.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });

        // Чистая векторная иконка Пуск/Пауза (▶/⏸) из плеера без кружка/квадрата
        btnPlayPause = new ActionIconView(context, ICON_PLAY, 0xFFFFFFFF, 0.72f);
        btnPlayPause.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isPlaying = !isPlaying;
                lastPosUpdateUptimeMs = android.os.SystemClock.uptimeMillis();
                refreshUi();
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('toggle',''); else if(window.togglePlay) window.togglePlay();");
            }
        });

        // Чистая векторная иконка Следующий (▶|) из плеера без кружка/квадрата
        btnNext = new ActionIconView(context, ICON_NEXT, 0xFFD2A8FF, 0.58f);
        btnNext.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });

        // Чисто текст «+10с» без жёлтых значков и без рамки
        btnFwd10 = createBorderlessStepButton("+10с");
        btnFwd10.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                seekRelativeSeconds(10.0);
            }
        });

        rowTransport.addView(btnRew10, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));
        rowTransport.addView(btnPrev, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));
        rowTransport.addView(btnPlayPause, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.15f));
        rowTransport.addView(btnNext, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));
        rowTransport.addView(btnFwd10, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        card.addView(rowTransport, rowTransLp);

        return card;
    }

    private SourceIconView createSourceIconButton(final String modeKey, int signatureColor) {
        SourceIconView iv = new SourceIconView(context, modeKey, signatureColor, true, 0.62f);
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

    private TextView createBorderlessStepButton(String label) {
        TextView tv = new TextView(context);
        tv.setText(label);
        tv.setGravity(Gravity.CENTER);
        tv.setSingleLine(true);
        tv.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, U(12.0f));
        tv.setTextColor(0xFFD2A8FF);
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
            int padV = U(8.5f);
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

    private void applyFullChameleonTheme(String activeMode) {
        String m = (activeMode != null) ? activeMode.toLowerCase(Locale.ROOT) : "music";

        int primary = COLOR_ICON_MUSIC;
        int bright = 0xFFD2A8FF;
        int secondary = 0xFF6E38C5;
        int darkTint = 0x170D2B;
        int dimBorder = 0xFF4B327A;

        if ("radio".equals(m)) {
            primary = COLOR_ICON_RADIO;      // #58A6FF
            bright = 0xFF79C0FF;
            secondary = 0xFF1F6FEB;
            darkTint = 0x09192E;
            dimBorder = 0xFF264F88;
        } else if ("soundcloud".equals(m)) {
            primary = COLOR_ICON_SOUNDCLOUD; // #FF8C42
            bright = 0xFFFFB070;
            secondary = 0xFFD9531E;
            darkTint = 0x261209;
            dimBorder = 0xFF7A3E1D;
        } else if ("youtube".equals(m)) {
            primary = COLOR_ICON_YOUTUBE;    // #FF5555
            bright = 0xFFFF8888;
            secondary = 0xFFB62324;
            darkTint = 0x280B12;
            dimBorder = 0xFF7D2431;
        }

        // 1. Значки переключения источников (без рамок)
        if (modeBtnMusic != null) modeBtnMusic.updateTabVisualState("music".equals(m));
        if (modeBtnRadio != null) modeBtnRadio.updateTabVisualState("radio".equals(m));
        if (modeBtnSoundCloud != null) modeBtnSoundCloud.updateTabVisualState("soundcloud".equals(m));
        if (modeBtnYoutube != null) modeBtnYoutube.updateTabVisualState("youtube".equals(m));

        // 2. Фон и мягкое размытое свечение главной рамки
        if (expandedPlateCard != null) {
            expandedPlateCard.setColorsAndInvalidate(primary, darkTint);
        }
        if (collapsedMiniPill != null) {
            collapsedMiniPill.setColorsAndInvalidate(primary, darkTint);
        }

        // 3. Значок открытия плеера посередине и кнопка сворачивания ▲ справа
        if (openAppZoneBtn != null) {
            openAppZoneBtn.setIconColor(bright);
        }
        if (collapseBtn != null) {
            collapseBtn.setIconColor(bright);
        }

        // 4. Кнопка Экспорта в .xFLAC слева и кнопка Избранного справа (работают для локальных аудиофайлов "music")
        boolean isLocalMusic = "music".equals(m);
        if (exportTrackBtn != null) {
            exportTrackBtn.setVisibility(isLocalMusic ? View.VISIBLE : View.INVISIBLE);
            exportTrackBtn.setIconColor(bright);
        }
        if (favHeartBtn != null) {
            favHeartBtn.setVisibility(isLocalMusic ? View.VISIBLE : View.INVISIBLE);
            favHeartBtn.setFilledState(isCurrentTrackFav);
            favHeartBtn.setIconColor(isCurrentTrackFav ? 0xFFFF4D79 : bright);
        }

        if (islandSubtitleView != null) {
            islandSubtitleView.setTextColor(bright);
        }

        // 5. Шкала прогресса с лёгким свечением вокруг неё и таймеры
        if (elapsedTimeView != null) {
            elapsedTimeView.setTextColor(bright);
        }
        if (totalTimeView != null) {
            totalTimeView.setTextColor(primary);
        }
        if (islandSeekBar != null) {
            islandSeekBar.setGlowColor(primary);
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

        // 6. Кнопки транспорта без рамок (-10с, Пред, Пуск/Пауза, След, +10с)
        if (btnRew10 != null) {
            btnRew10.setTextColor(bright);
        }
        if (btnFwd10 != null) {
            btnFwd10.setTextColor(bright);
        }
        if (btnPrev != null) {
            btnPrev.setIconColor(bright);
        }
        if (btnNext != null) {
            btnNext.setIconColor(bright);
        }
        if (btnPlayPause != null) {
            btnPlayPause.setIconType(isPlaying ? ICON_PAUSE : ICON_PLAY);
            btnPlayPause.setIconColor(isPlaying ? 0xFFFFFFFF : bright);
        }

        // 7. Свёрнутая мини-капсула
        if (miniPillIconView != null) {
            miniPillIconView.setSourceTypeAndColor(m, primary);
        }
        if (miniPillPrevBtn != null) {
            miniPillPrevBtn.setIconColor(bright);
        }
        if (miniPillPlayBtn != null) {
            miniPillPlayBtn.setIconType(isPlaying ? ICON_PAUSE : ICON_PLAY);
            miniPillPlayBtn.setIconColor(isPlaying ? 0xFFFFFFFF : bright);
        }
        if (miniPillNextBtn != null) {
            miniPillNextBtn.setIconColor(bright);
        }
        if (miniPillExpandBtn != null) {
            miniPillExpandBtn.setIconColor(bright);
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
            float spd = Math.abs(currentSpeed) > 0.05f ? currentSpeed : 1.0f;
            base += Math.round(dt * spd);
        }
        if (base < 0L) {
            base = 0L;
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
            int prog = (dur > 0L) ? (int) Math.min(1000L, Math.max(0L, (pos * 1000L) / dur)) : 0;
            islandSeekBar.setProgress(prog);
        }
    }

    public void refreshUi() {
        if (!isIslandAttached) return;
        applyFullChameleonTheme(currentIslandMode);

        String displayTitle = currentTitle;
        String displaySub = currentSubtitle;
        if ("youtube".equals(currentIslandMode) && !isPlaying) {
            displayTitle = "YouTube Studio • Модуль в разработке";
            displaySub = "Заглушка: скоро прямое воспроизведение YouTube потоков";
        }

        if (islandTitleView != null) {
            if (!String.valueOf(islandTitleView.getText()).equals(displayTitle)) {
                islandTitleView.setText(displayTitle);
                islandTitleView.setSelected(true);
            }
        }
        if (islandSubtitleView != null) {
            islandSubtitleView.setText(displaySub);
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
