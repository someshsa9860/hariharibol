import 'package:flutter/material.dart';

/// The palette. Two of them, and they do not share a single colour.
///
/// **Light is dark orange, saffron and white.** Nothing else — no grey, no
/// green, no blue. The neutrals are all tints and shades of the one orange hue,
/// so a "grey" label is really the palest brown-orange and near-black text is
/// really the darkest. That is what keeps a screen with no brand colour on it
/// still looking like this app rather than a default Material one.
///
/// **Dark is black and white.** No orange at all: on a black ground the brand
/// orange glows and pulls the eye off the verse, which is the one thing on the
/// screen meant to be read. So dark mode is a pure greyscale ramp and the
/// accent is simply white.
///
/// The consequence to design around: in dark mode **no colour carries meaning**
/// — every state that light mode says with a shade of orange has to be said
/// again with an icon or a word.
///
/// Every colour in the app comes from here or from the [ColorScheme] built from
/// it — no `Color(0xFF…)` anywhere else.
abstract final class AppColors {
  // ── Orange ─────────────────────────────────────────────────────────────────

  /// The brand. Primary, and the only colour used for an action.
  static const Color orange = Color(0xFFC2410C);

  /// Pressed and hovered states, and the darker half of a gradient.
  static const Color orangeDark = Color(0xFF9A3412);

  /// The deepest shade. Destructive actions and the darkest ink.
  static const Color orangeDeep = Color(0xFF7C2D12);

  // ── Saffron ────────────────────────────────────────────────────────────────

  /// The lighter, warmer accent — progress, motifs, highlights.
  ///
  /// Never text: on white it is about 2:1, which fails badly. Saffron is a
  /// fill, and what sits on it is [ink].
  static const Color saffron = Color(0xFFEA8C0C);

  static const Color saffronLight = Color(0xFFFDBA4A);

  /// The tint that stands in for a "light grey" fill.
  static const Color saffronPale = Color(0xFFFDF0DC);

  // ── White, and the tints that stand in for grey ─────────────────────────────

  static const Color white = Color(0xFFFFFFFF);

  /// The page. A white with the faintest saffron in it, so a pure-white card
  /// on top of it still reads as a separate plane.
  static const Color paper = Color(0xFFFFFBF6);

  /// A filled input or a tinted panel.
  static const Color paperTint = Color(0xFFFDF4EA);

  /// Borders and dividers.
  static const Color hairline = Color(0xFFF0DFCB);
  static const Color outline = Color(0xFFC9A184);

  /// Body text: the darkest tone of the same orange, not a neutral black.
  static const Color ink = Color(0xFF2E1607);

  /// Secondary text. 5.8:1 on white — the lightest this is allowed to get.
  static const Color inkMuted = Color(0xFF8A5A3B);

  // ── Dark: black and white, and the greys between them ──────────────────────

  /// True black, not a dark grey — it costs nothing on an OLED panel and it is
  /// the only ground the white type sits on at full contrast.
  static const Color black = Color(0xFF000000);

  static const Color paperDark = black;
  static const Color cardDark = Color(0xFF121212);
  static const Color paperTintDark = Color(0xFF1F1F1F);
  static const Color hairlineDark = Color(0xFF262626);
  static const Color outlineDark = Color(0xFF525252);
  static const Color inkDark = white;

  /// Secondary text on black. 9:1 — well clear, because dark-mode type at low
  /// contrast is the first thing to become unreadable in sunlight.
  static const Color inkMutedDark = Color(0xFFA3A3A3);

  /// One step down from white, for a surface or a label that needs to sit
  /// just under it.
  static const Color inkSubtleDark = Color(0xFFD4D4D4);

  /// The accent, such as it is. White does the work orange does in light mode.
  static const Color accentDark = white;

  // ── Decorative panels ──────────────────────────────────────────────────────

  /// The gradient behind a line-art motif. Named here rather than typed into
  /// each card, so the panels on the verse, the sadhana strip and a coverless
  /// book are the same wash.
  // ── The reel surface ───────────────────────────────────────────────────────

  /// A reel plays edge to edge over its own black ground, in **both** themes.
  ///
  /// This is the one surface that does not follow the light palette, and the
  /// reason is the same one behind the colour rule itself: the media is the
  /// thing meant to be looked at. Warm paper behind a video would tint it, and
  /// orange chrome over someone's footage competes with it. So the overlays
  /// are white on a black scrim, which is legible over any frame, and the
  /// **state is carried by the icon** — filled versus outline — rather than by
  /// a hue, exactly as the rule requires for a mode that has no colours to
  /// spend.
  ///
  /// Named here rather than typed into the widgets so the whole surface can be
  /// retuned in one place, same as every other colour in the app.
  static const Color reelGround = black;
  static const Color reelInk = white;

  /// The gradient that makes white text readable over an unknown frame. Weak
  /// at the top (the close button) and strong at the bottom (the caption),
  /// because that is where the text actually is.
  static const Color reelScrimStrong = Color(0xCC000000);
  static const Color reelScrimSoft = Color(0x66000000);

  /// A control that needs to be visible over a bright frame — the mute
  /// toggle, a slideshow dot. Not a border, a wash.
  static const Color reelControl = Color(0x33FFFFFF);

  /// The colours an admin can choose for text laid over a reel. Named by role
  /// rather than by hue, because the editor offers three words — light, dark,
  /// accent — and the app decides what each looks like. Like the rest of the
  /// reel surface they do not change with the theme.
  static const Color reelOverlayLight = white;
  static const Color reelOverlayDark = ink;
  static const Color reelOverlayAccent = saffronLight;

  /// What keeps that text readable over a bright or busy frame: a soft dark
  /// shadow behind light text, a soft light glow behind dark text.
  static const Color reelTextShadow = Color(0x99000000);
  static const Color reelTextGlow = Color(0x66FFFFFF);

  // ── The days of the week ───────────────────────────────────────────────────

  /// The one place the palette rule bends. The routine tab's date strip prints
  /// each weekday's initial in a colour of its own — Thursday yellow, Saturday
  /// black, Wednesday red — so a week can be read at a glance, the way a
  /// printed almanac colours its days.
  ///
  /// It is **decoration only**, which is what keeps it inside the rule's
  /// reason: the letter says which day it is, the full day name is the screen
  /// reader's label, and the colour never carries a state. Indexed by
  /// `DateTime.weekday % 7`, so Sunday is 0. Dark mode has its own, lighter
  /// set (Saturday is white there; black on black would vanish).
  static const List<Color> weekdayLight = [
    Color(0xFFEA580C), // Sunday: orange
    Color(0xFF2563EB), // Monday: blue
    Color(0xFF15803D), // Tuesday: green
    Color(0xFFDC2626), // Wednesday: red
    Color(0xFFCA8A04), // Thursday: yellow
    Color(0xFF9333EA), // Friday: violet
    Color(0xFF171717), // Saturday: black
  ];

  static const List<Color> weekdayDark = [
    Color(0xFFFB923C),
    Color(0xFF60A5FA),
    Color(0xFF4ADE80),
    Color(0xFFF87171),
    Color(0xFFFACC15),
    Color(0xFFC084FC),
    white,
  ];

  /// The colour of [weekday] (`DateTime.monday` … `DateTime.sunday`).
  static Color forWeekday(int weekday, {required bool isLight}) =>
      (isLight ? weekdayLight : weekdayDark)[weekday % DateTime.daysPerWeek];

  static const Color panelFrom = Color(0xFFFDF0DC);
  static const Color panelTo = Color(0xFFF6D9AE);
  static const Color panelFromDark = Color(0xFF141414);
  static const Color panelToDark = Color(0xFF1F1F1F);
}

/// Semantic colours that are not part of [ColorScheme], resolved per brightness.
///
/// These can only differ by **tone**, never by hue: in light mode success is
/// the deepest orange, warning is saffron and info is the brand; in dark mode
/// all three are greys. So none of them may ever be the only thing carrying the
/// meaning — pair every one with an icon or a word, because nobody can read
/// "done" out of a shade.
///
/// Read them with `Theme.of(context).extension<AppSemanticColors>()!` — or the
/// `context.semanticColors` helper in `app_theme.dart`.
@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.success,
    required this.warning,
    required this.info,
  });

  final Color success;
  final Color warning;
  final Color info;

  static const AppSemanticColors light = AppSemanticColors(
    success: AppColors.orangeDeep,
    warning: AppColors.saffron,
    info: AppColors.orange,
  );

  // Dark mode has no hues to spend, so these are three steps of grey. They are
  // close to useless on their own — see the note above: the icon says it.
  static const AppSemanticColors dark = AppSemanticColors(
    success: AppColors.white,
    warning: AppColors.inkSubtleDark,
    info: AppColors.inkMutedDark,
  );

  @override
  AppSemanticColors copyWith({Color? success, Color? warning, Color? info}) {
    return AppSemanticColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
    );
  }

  @override
  AppSemanticColors lerp(AppSemanticColors? other, double t) {
    if (other == null) return this;
    return AppSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}
