package com.jenny.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Resources;
import android.graphics.Canvas;
import android.graphics.Insets;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Shader;
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
 * [FIX-ISLAND-OVERLAY] Отдельный контроллер верхней плашки плеера (Dynamic Island Overlay V247).
 * Реализует:
 * 1. Компактную мини-плашку прямо под строкой состояния (укороченную на ~1/3, без текста, с 5 широкими зонами нажатия во всю высоту планки и чистыми векторными значками без рамок/кружков: [Мелодия -> Плеер] [|◀ Пред] [▶/⏸ Плей] [▶| След] [▼ Разворот]).
 * 2. Полное скрытие плашки внутри самого Jenny Player и автоматическое появление мини-плашки при сворачивании.
 * 3. Автоматическое сворачивание большой плашки в мини-плашку по кнопкам «Домой», «Назад» или касанию вне плашки.
 * 4. Шапку большой плашки с 4 векторными значками источников, фирменным векторным логотипом JENNY PLAYER (без v1.1, сдвинутым влево к значкам источников и открывающим плеер по тапу) и кнопкой сворачивания ▲ справа.
 * 5. Второй ряд большой плашки: слева векторная кнопка «Поделиться / Экспорт» (точная копия кнопки справа от громкости внизу плеера), по центру плавная бегущая строка (Marquee) названия трека, справа векторная кнопка «Избранное» (сердечко из нижнего бара плеера).
 * 6. Нижний транспортный ряд из 3 чистых векторных кнопок (|◀ Пред, ▶/⏸ Плей/Пауза, ▶| След — точные копии нижнего бара плеера без текстовых подписей).
 * 7. Полную хамелеон-перекраску всего интерфейса плашки и мини-капсулы в цвет активного значка источника.
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
    private boolean isIslandExpanded = false;
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

    // Фирменные цвета значков источников (сами 4 значка переключения всегда остаются в своих цветах)
    private static final int COLOR_ICON_MUSIC      = 0xFFA371F7; // Фиолетовый неон
    private static final int COLOR_ICON_RADIO      = 0xFF58A6FF; // Голубой неон
    private static final int COLOR_ICON_SOUNDCLOUD = 0xFFFF8C42; // Оранжевое облачко SoundCloud
    private static final int COLOR_ICON_YOUTUBE    = 0xFFFF5555; // Красный неон YouTube

    // Типы векторных иконок действий (точные копии SVG из нижнего бара Jenny Player)
    private static final int ICON_PREV         = 1;
    private static final int ICON_PLAY         = 2;
    private static final int ICON_PAUSE        = 3;
    private static final int ICON_NEXT         = 4;
    private static final int ICON_SHARE        = 5;
    private static final int ICON_HEART        = 6;
    private static final int ICON_CHEVRON_UP   = 7;
    private static final int ICON_CHEVRON_DOWN = 8;

    // Виджеты развёрнутой плашки
    private GradientDrawable plateCardBgDrawable;
    private SourceIconView modeBtnMusic;
    private SourceIconView modeBtnRadio;
    private SourceIconView modeBtnSoundCloud;
    private SourceIconView modeBtnYoutube;
    private JennyBrandLogoView jennyBrandLogoView;
    private ActionIconView collapseBtn;
    private GradientDrawable collapseBtnBg;

    private ActionIconView shareTrackBtn;
    private GradientDrawable shareTrackBtnBg;
    private TextView islandTitleView;
    private TextView islandSubtitleView;
    private ActionIconView favHeartBtn;
    private GradientDrawable favHeartBgDrawable;

    private TextView elapsedTimeView;
    private TextView totalTimeView;
    private SeekBar islandSeekBar;
    private GradientDrawable seekBgTrackDrawable;
    private GradientDrawable seekProgGradDrawable;
    private GradientDrawable seekThumbDrawable;

    private ActionIconView btnPrev;
    private GradientDrawable btnPrevBg;
    private ActionIconView btnPlayPause;
    private GradientDrawable btnPlayPauseBgDrawable;
    private ActionIconView btnNext;
    private GradientDrawable btnNextBg;

    // Виджеты свёрнутой мини-капсулы (5 широких зон без рамок вокруг иконок)
    private GradientDrawable miniPillBgDrawable;
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
     * Кастомный векторный значок источника (рисует точные векторные иконки из шапки Jenny Player).
     */
    private final class SourceIconView extends View {
        private String sourceType;
        private int iconColor;
        private final boolean isTabButton;
        private final float iconScaleRatio;
        private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rectF = new RectF();
        private final GradientDrawable tabBg = new GradientDrawable();

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

            float size = Math.min(w, h) * iconScaleRatio;
            float ox = (w - size) * 0.5f;
            float oy = (h - size) * 0.5f;
            float s = size / 24.0f;

            strokePaint.setColor(iconColor);
            strokePaint.setStrokeWidth(Math.max(2.0f, 2.05f * s));
            fillPaint.setColor(iconColor);

            if ("soundcloud".equals(sourceType)) {
                // Оранжевое облачко SoundCloud + 3 полоски эквалайзера слева (JENNY_NEON_SVGS_V92.soundcloud)
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
                // Спутниковый локатор Радио с волнами (JENNY_NEON_SVGS_V92.radio)
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
                // Красный экран YouTube с треугольником Play (JENNY_NEON_SVGS_V92.youtube)
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

    /**
     * Точные векторные иконки кнопок управления из нижнего бара Jenny Player:
     * Prev (|◀), Play (▶), Pause (⏸), Next (▶|), Share/Export (стрелка вверх из лотка), Heart (Избранное), Chevrons (▲/▼).
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
            } else if (iconType == ICON_SHARE) {
                // Точная копия #btnExport (справа от кнопки громкости):
                // <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
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
                // Точная копия #btn-favModal:
                // <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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

    /**
     * Фирменный векторный логотип JENNY PLAYER из шапки плеера (#jennyLogoWrap в index.html, без плашки v1.1):
     * Сине-фиолетовый значок с белой звуковой волной + двухстрочная надпись JENNY / PLAYER.
     */
    private final class JennyBrandLogoView extends View {
        private int accentBorderColor = 0xFF58A6FF;
        private int playerSubColor = 0xFFD2A8FF;
        private final Paint boxFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint boxStrokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint wavePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint jennyTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint dividerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint playerTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path wavePath = new Path();
        private final RectF boxRect = new RectF();
        private int cachedW = -1;
        private int cachedH = -1;

        JennyBrandLogoView(Context ctx) {
            super(ctx);
            boxFillPaint.setStyle(Paint.Style.FILL);
            boxStrokePaint.setStyle(Paint.Style.STROKE);

            wavePaint.setStyle(Paint.Style.STROKE);
            wavePaint.setColor(0xFFFFFFFF);
            wavePaint.setStrokeCap(Paint.Cap.ROUND);
            wavePaint.setStrokeJoin(Paint.Join.ROUND);

            Typeface boldMono = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD);
            jennyTextPaint.setTypeface(boldMono);
            playerTextPaint.setTypeface(boldMono);
            dividerPaint.setStyle(Paint.Style.STROKE);
        }

        void setThemeColors(int primaryColor, int brightColor) {
            this.accentBorderColor = primaryColor;
            this.playerSubColor = brightColor;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return;

            float boxSize = h * 0.84f;
            float boxTop = (h - boxSize) * 0.5f;
            float boxLeft = U(2.0f);
            boxRect.set(boxLeft, boxTop, boxLeft + boxSize, boxTop + boxSize);

            if (w != cachedW || h != cachedH) {
                cachedW = w;
                cachedH = h;
                boxFillPaint.setShader(new LinearGradient(
                        boxRect.left, boxRect.top, boxRect.right, boxRect.bottom,
                        0xFF7341BE, 0xFF1F6FEB, Shader.TileMode.CLAMP
                ));
                float textStartX = boxRect.right + U(6.0f);
                jennyTextPaint.setShader(new LinearGradient(
                        textStartX, 0, textStartX + U(56.0f), 0,
                        0xFF3FB950, 0xFF58A6FF, Shader.TileMode.CLAMP
                ));
            }

            boxStrokePaint.setColor(accentBorderColor);
            boxStrokePaint.setStrokeWidth(U(1.1f));
            canvas.drawRoundRect(boxRect, U(6.5f), U(6.5f), boxFillPaint);
            canvas.drawRoundRect(boxRect, U(6.5f), U(6.5f), boxStrokePaint);

            // Белый импульс волны внутри значка: <path d="M6 17h3l2.5-7 4 14 3.5-10 2 3h3"/>
            float bs = boxSize / 28.0f;
            float bx = boxRect.left - 1.0f * bs;
            float by = boxRect.top - 3.0f * bs;
            wavePaint.setStrokeWidth(Math.max(2.0f, 2.0f * bs));
            wavePath.reset();
            wavePath.moveTo(bx + 6.0f * bs, by + 17.0f * bs);
            wavePath.lineTo(bx + 9.0f * bs, by + 17.0f * bs);
            wavePath.lineTo(bx + 11.5f * bs, by + 10.0f * bs);
            wavePath.lineTo(bx + 15.5f * bs, by + 24.0f * bs);
            wavePath.lineTo(bx + 19.0f * bs, by + 14.0f * bs);
            wavePath.lineTo(bx + 21.0f * bs, by + 17.0f * bs);
            wavePath.lineTo(bx + 24.0f * bs, by + 17.0f * bs);
            canvas.drawPath(wavePath, wavePaint);

            // Двухстрочная надпись JENNY / PLAYER (без v1.1)
            float tx = boxRect.right + U(6.0f);
            jennyTextPaint.setTextSize(U(12.2f));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                jennyTextPaint.setLetterSpacing(0.14f);
            }
            canvas.drawText("JENNY", tx, boxTop + boxSize * 0.43f, jennyTextPaint);

            float divY = boxTop + boxSize * 0.55f;
            dividerPaint.setColor((accentBorderColor & 0x00FFFFFF) | 0x78000000);
            dividerPaint.setStrokeWidth(Math.max(1.0f, U(0.9f)));
            canvas.drawLine(tx, divY, Math.min(w - U(2.0f), tx + U(56.0f)), divY, dividerPaint);

            playerTextPaint.setColor(playerSubColor);
            playerTextPaint.setTextSize(U(9.4f));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                playerTextPaint.setLetterSpacing(0.22f);
            }
            canvas.drawText("PLAYER", tx, boxTop + boxSize * 0.92f, playerTextPaint);
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

        // Мини-плашка укорочена примерно на треть (142u вместо 212u -> ~424px), стоит прямо ПОД строкой состояния!
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
        islandLayoutParams.setTitle("JennyDynamicIslandOverlayV247");

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
     * Свёрнутая мини-плашка без текста, укороченная на треть, разделённая на 5 широких зон во всю высоту планки
     * (только чистые векторные значки без кругов и прямоугольников вокруг них):
     * 1) [Значок мелодии/источника] -> открывает сам Jenny Player
     * 2) [|◀ Пред] -> предыдущий трек/станция
     * 3) [▶/⏸ Плей/Пауза] -> пуск/пауза
     * 4) [▶| След] -> следующий трек/станция
     * 5) [▼ Разворот] -> разворачивает в большую плашку
     */
    private LinearLayout buildCollapsedMiniPillView() {
        LinearLayout pill = new LinearLayout(context);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(U(4), 0, U(4), 0);

        miniPillBgDrawable = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0xF4080B14, 0xF4121829, 0xF4180E2E}
        );
        miniPillBgDrawable.setCornerRadius(U(18));
        miniPillBgDrawable.setStroke(U(1.5f), COLOR_ICON_MUSIC);
        pill.setBackground(miniPillBgDrawable);

        // Зона 1 (слева): значок мелодии/источника -> открывает сам плеер!
        miniPillIconView = new SourceIconView(context, "music", COLOR_ICON_MUSIC, false, 0.56f);
        miniPillIconView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        pill.addView(miniPillIconView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // Зона 2: Предыдущий (|◀)
        miniPillPrevBtn = new ActionIconView(context, ICON_PREV, 0xFFD2A8FF, 0.52f);
        miniPillPrevBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });
        pill.addView(miniPillPrevBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // Зона 3 (по центру): Плей / Пауза (▶ / ⏸)
        miniPillPlayBtn = new ActionIconView(context, ICON_PLAY, 0xFFFFFFFF, 0.58f);
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

        // Зона 4: Следующий (▶|)
        miniPillNextBtn = new ActionIconView(context, ICON_NEXT, 0xFFD2A8FF, 0.52f);
        miniPillNextBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });
        pill.addView(miniPillNextBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

        // Зона 5 (справа): Разворот в большую плашку (▼)
        miniPillExpandBtn = new ActionIconView(context, ICON_CHEVRON_DOWN, 0xFFD2A8FF, 0.48f);
        miniPillExpandBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(true);
            }
        });
        pill.addView(miniPillExpandBtn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f));

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
        // РЯД 1: 4 ЗНАЧКА ИСТОЧНИКОВ + СДВИНУТЫЙ ВЛЕВО ЛОГОТИП JENNY PLAYER (БЕЗ v1.1) + КНОПКА СВОРАЧИВАНИЯ ▲ СПРАВА
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
        iconBtnLp4.rightMargin = U(7.0f);

        rowModes.addView(modeBtnMusic, iconBtnLp1);
        rowModes.addView(modeBtnRadio, iconBtnLp2);
        rowModes.addView(modeBtnSoundCloud, iconBtnLp3);
        rowModes.addView(modeBtnYoutube, iconBtnLp4);

        // Фирменный логотип JENNY PLAYER (сдвинут влево к 4 значкам источников, при тапе открывает сам плеер!)
        jennyBrandLogoView = new JennyBrandLogoView(context);
        jennyBrandLogoView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
            }
        });
        LinearLayout.LayoutParams brandLp = new LinearLayout.LayoutParams(U(94), LinearLayout.LayoutParams.MATCH_PARENT);
        rowModes.addView(jennyBrandLogoView, brandLp);

        // Распорка, отодвигающая кнопку сворачивания ▲ в правый край
        View headerSpacer = new View(context);
        rowModes.addView(headerSpacer, new LinearLayout.LayoutParams(0, 1, 1.0f));

        // Кнопка сворачивания плашки в мини-капсулу (▲)
        collapseBtnBg = new GradientDrawable();
        collapseBtnBg.setColor(0xFF161229);
        collapseBtnBg.setCornerRadius(U(9.5f));
        collapseBtnBg.setStroke(U(1.1f), 0xFF4B327A);
        collapseBtn = new ActionIconView(context, ICON_CHEVRON_UP, 0xFFD2A8FF, 0.54f);
        collapseBtn.setBackground(collapseBtnBg);
        collapseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                setExpanded(false);
            }
        });
        LinearLayout.LayoutParams colBtnLp = new LinearLayout.LayoutParams(U(34), LinearLayout.LayoutParams.MATCH_PARENT);
        rowModes.addView(collapseBtn, colBtnLp);

        card.addView(rowModes, rowModesLp);

        // ---------------------------------------------------------------------
        // РЯД 2: КНОПКА «ПОДЕЛИТЬСЯ / ЭКСПОРТ» СЛЕВА + БЕГУЩАЯ СТРОКА НАЗВАНИЯ ТРЕКА + ВЕКТОРНОЕ СЕРДЕЧКО СПРАВА
        // ---------------------------------------------------------------------
        LinearLayout rowTrack = new LinearLayout(context);
        rowTrack.setOrientation(LinearLayout.HORIZONTAL);
        rowTrack.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTrackLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(45));
        rowTrackLp.bottomMargin = U(4);

        // Кнопка «Поделиться / Экспорт» (точная векторная копия кнопки #btnExport справа от громкости внизу плеера)
        shareTrackBtnBg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF1A1330, 0xFF120C24}
        );
        shareTrackBtnBg.setCornerRadius(U(13));
        shareTrackBtnBg.setStroke(U(1.4f), COLOR_ICON_MUSIC);
        shareTrackBtn = new ActionIconView(context, ICON_SHARE, 0xFFD2A8FF, 0.50f);
        shareTrackBtn.setBackground(shareTrackBtnBg);
        shareTrackBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openMainActivityFromIsland();
                mainHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('share',''); else if(window.exportCurrentTrack) window.exportCurrentTrack();");
                    }
                }, 220L);
            }
        });
        LinearLayout.LayoutParams shareLp = new LinearLayout.LayoutParams(U(43), U(43));
        shareLp.rightMargin = U(9);
        rowTrack.addView(shareTrackBtn, shareLp);

        LinearLayout textCol = new LinearLayout(context);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setGravity(Gravity.CENTER_VERTICAL);

        // Бегущая строка (Marquee) с гарантированным авто-фокусом, чтобы длинные названия плавно бежали!
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
        textColLp.rightMargin = U(8);
        rowTrack.addView(textCol, textColLp);

        // Векторная кнопка «Избранное» (точная копия сердечка из нижнего бара плеера)
        favHeartBgDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF161C2C, 0xFF1F1632}
        );
        favHeartBgDrawable.setCornerRadius(U(13));
        favHeartBgDrawable.setStroke(U(1.4f), 0xFF4B327A);
        favHeartBtn = new ActionIconView(context, ICON_HEART, 0xFFD2A8FF, 0.50f);
        favHeartBtn.setBackground(favHeartBgDrawable);
        favHeartBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isCurrentTrackFav = !isCurrentTrackFav;
                refreshUi();
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
        // РЯД 4: 3 ЧИСТЫЕ ВЕКТОРНЫЕ КНОПКИ ТРАНСПОРТА ИЗ НИЖНЕГО БАРА ПЛЕЕРА (|◀ ПРЕД | ▶/⏸ ПУСК | ▶| СЛЕД)
        // ---------------------------------------------------------------------
        LinearLayout rowTransport = new LinearLayout(context);
        rowTransport.setOrientation(LinearLayout.HORIZONTAL);
        rowTransport.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowTransLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, U(38));

        btnPrevBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF161229, 0xFF1E1736});
        btnPrevBg.setCornerRadius(U(13));
        btnPrevBg.setStroke(U(1.3f), 0xFF4B327A);
        btnPrev = new ActionIconView(context, ICON_PREV, 0xFFF0F6FC, 0.56f);
        btnPrev.setBackground(btnPrevBg);
        btnPrev.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('prev',''); else if(window.playPreviousTrack) window.playPreviousTrack();");
            }
        });

        btnPlayPauseBgDrawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF6E38C5, 0xFFA371F7});
        btnPlayPauseBgDrawable.setCornerRadius(U(14));
        btnPlayPauseBgDrawable.setStroke(U(1.5f), 0xFFD2A8FF);
        btnPlayPause = new ActionIconView(context, ICON_PLAY, 0xFFFFFFFF, 0.64f);
        btnPlayPause.setBackground(btnPlayPauseBgDrawable);
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
        btnNextBg.setCornerRadius(U(13));
        btnNextBg.setStroke(U(1.3f), 0xFF4B327A);
        btnNext = new ActionIconView(context, ICON_NEXT, 0xFFF0F6FC, 0.56f);
        btnNext.setBackground(btnNextBg);
        btnNext.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.evalJs("if(window.handleIslandCommandV245) window.handleIslandCommandV245('next',''); else if(window.playNextTrack) window.playNextTrack();");
            }
        });

        LinearLayout.LayoutParams trLp1 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f);
        trLp1.rightMargin = U(8.0f);
        LinearLayout.LayoutParams trLp2 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.35f);
        trLp2.rightMargin = U(8.0f);
        LinearLayout.LayoutParams trLp3 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.0f);

        rowTransport.addView(btnPrev, trLp1);
        rowTransport.addView(btnPlayPause, trLp2);
        rowTransport.addView(btnNext, trLp3);

        card.addView(rowTransport, rowTransLp);

        return card;
    }

    private SourceIconView createSourceIconButton(final String modeKey, int signatureColor) {
        SourceIconView iv = new SourceIconView(context, modeKey, signatureColor, true, 0.64f);
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

    private void styleFavoriteButton(boolean isFav, int primary, int bright, int themeDimBorder, int themeSurfaceTint) {
        if (favHeartBtn == null || favHeartBgDrawable == null) return;
        favHeartBtn.setFilledState(isFav);
        if (isFav) {
            favHeartBtn.setIconColor(0xFFFF4D79);
            favHeartBgDrawable.setColors(new int[]{0xFF4A1228, 0xFF2E0F24});
            favHeartBgDrawable.setStroke(U(1.5f), 0xFFFF4D79);
        } else {
            favHeartBtn.setIconColor(bright);
            favHeartBgDrawable.setColors(new int[]{themeSurfaceTint, 0xFF121622});
            favHeartBgDrawable.setStroke(U(1.3f), themeDimBorder);
        }
    }

    /**
     * Перекрашивает ВЕСЬ интерфейс плашки и мини-капсулы (кроме самих 4 значков источников)
     * в цветовую палитру активного значка источника!
     */
    private void applyFullChameleonTheme(String activeMode) {
        String m = (activeMode != null) ? activeMode.toLowerCase(Locale.ROOT) : "music";

        int primary = COLOR_ICON_MUSIC;
        int bright = 0xFFD2A8FF;
        int secondary = 0xFF6E38C5;
        int darkTint = 0xFA170D2B;
        int surfaceTint = 0xFF1A1330;
        int dimBorder = 0xFF4B327A;

        if ("radio".equals(m)) {
            primary = COLOR_ICON_RADIO;      // #58A6FF Голубой неон
            bright = 0xFF79C0FF;
            secondary = 0xFF1F6FEB;
            darkTint = 0xFA09192E;
            surfaceTint = 0xFF0F1E36;
            dimBorder = 0xFF264F88;
        } else if ("soundcloud".equals(m)) {
            primary = COLOR_ICON_SOUNDCLOUD; // #FF8C42 Оранжевое облачко
            bright = 0xFFFFB070;
            secondary = 0xFFD9531E;
            darkTint = 0xFA261209;
            surfaceTint = 0xFF2B170E;
            dimBorder = 0xFF7A3E1D;
        } else if ("youtube".equals(m)) {
            primary = COLOR_ICON_YOUTUBE;    // #FF5555 Красный неон YouTube
            bright = 0xFFFF8888;
            secondary = 0xFFB62324;
            darkTint = 0xFA280B12;
            surfaceTint = 0xFF2B1118;
            dimBorder = 0xFF7D2431;
        }

        // 1. Четыре значка переключения источников сохраняют свои фирменные цвета
        if (modeBtnMusic != null) modeBtnMusic.updateTabVisualState("music".equals(m));
        if (modeBtnRadio != null) modeBtnRadio.updateTabVisualState("radio".equals(m));
        if (modeBtnSoundCloud != null) modeBtnSoundCloud.updateTabVisualState("soundcloud".equals(m));
        if (modeBtnYoutube != null) modeBtnYoutube.updateTabVisualState("youtube".equals(m));

        // 2. Фон и неоновая рамка большой плашки
        if (plateCardBgDrawable != null) {
            plateCardBgDrawable.setColors(new int[]{0xFA070A12, 0xFA0C111E, darkTint});
            plateCardBgDrawable.setStroke(U(1.9f), primary);
        }

        // 3. Фирменный логотип JENNY PLAYER и кнопка сворачивания ▲ в шапке
        if (jennyBrandLogoView != null) {
            jennyBrandLogoView.setThemeColors(primary, bright);
        }
        if (collapseBtn != null && collapseBtnBg != null) {
            collapseBtn.setIconColor(bright);
            collapseBtnBg.setColor(surfaceTint);
            collapseBtnBg.setStroke(U(1.2f), dimBorder);
        }

        // 4. Кнопка «Поделиться / Экспорт» слева во 2-м ряду + подзаголовок + Сердечко справа
        if (shareTrackBtn != null && shareTrackBtnBg != null) {
            shareTrackBtn.setIconColor(bright);
            shareTrackBtnBg.setColors(new int[]{surfaceTint, darkTint});
            shareTrackBtnBg.setStroke(U(1.4f), primary);
        }
        if (islandSubtitleView != null) {
            islandSubtitleView.setTextColor(bright);
        }
        styleFavoriteButton(isCurrentTrackFav, primary, bright, dimBorder, surfaceTint);

        // 5. Шкала прогресса (Seek) и таймеры
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

        // 6. Три чистые векторные кнопки транспорта (|◀ Пред, ▶/⏸ Плей, ▶| След)
        if (btnPrev != null && btnPrevBg != null) {
            btnPrev.setIconColor(bright);
            btnPrevBg.setColors(new int[]{surfaceTint, 0xFF121724});
            btnPrevBg.setStroke(U(1.3f), dimBorder);
        }
        if (btnNext != null && btnNextBg != null) {
            btnNext.setIconColor(bright);
            btnNextBg.setColors(new int[]{surfaceTint, 0xFF121724});
            btnNextBg.setStroke(U(1.3f), dimBorder);
        }
        if (btnPlayPause != null && btnPlayPauseBgDrawable != null) {
            btnPlayPause.setIconType(isPlaying ? ICON_PAUSE : ICON_PLAY);
            btnPlayPause.setIconColor(isPlaying ? 0xFFFFFFFF : bright);
            btnPlayPauseBgDrawable.setColors(isPlaying
                    ? new int[]{secondary, primary}
                    : new int[]{surfaceTint, darkTint});
            btnPlayPauseBgDrawable.setStroke(U(1.5f), isPlaying ? bright : primary);
        }

        // 7. Свёрнутая мини-плашка (5 чистых векторных иконок без внутренних рамок в цвете активного источника)
        if (miniPillBgDrawable != null) {
            miniPillBgDrawable.setColors(new int[]{0xF4080B14, surfaceTint, darkTint});
            miniPillBgDrawable.setStroke(U(1.5f), primary);
        }
        if (miniPillIconView != null) {
            miniPillIconView.setSourceTypeAndColor(m, primary);
        }
        if (miniPillPrevBtn != null) {
            miniPillPrevBtn.setIconColor(bright);
        }
        if (miniPillPlayBtn != null) {
            miniPillPlayBtn.setIconType(isPlaying ? ICON_PAUSE : ICON_PLAY);
            miniPillPlayBtn.setIconColor(0xFFFFFFFF);
        }
        if (miniPillNextBtn != null) {
            miniPillNextBtn.setIconColor(bright);
        }
        if (miniPillExpandBtn != null) {
            miniPillExpandBtn.setIconColor(bright);
        }
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
