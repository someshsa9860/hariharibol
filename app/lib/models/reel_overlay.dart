import 'json.dart';

/// Which of the app's own type styles a text box uses. The admin editor picks
/// a name, never a font, so the app is free to resolve it against its theme.
enum ReelOverlayStyle {
  body,
  heading,
  verse;

  static ReelOverlayStyle parse(dynamic value) => values.asNameMap()[asString(value)] ?? body;
}

/// Which reel-surface colour a text box uses. Named for the same reason as
/// [ReelOverlayStyle]: the palette is the app's, not the editor's.
enum ReelOverlayColor {
  light,
  dark,
  accent;

  static ReelOverlayColor parse(dynamic value) => values.asNameMap()[asString(value)] ?? light;
}

enum ReelOverlayAlign {
  left,
  center,
  right;

  static ReelOverlayAlign parse(dynamic value) => values.asNameMap()[asString(value)] ?? center;
}

/// One box of text an admin laid over a reel in the panel's editor.
///
/// Everything is a percentage of the frame, so one saved layout lands in the
/// same place on every screen: [x] and [y] are the box's top-left as a share of
/// the frame's width and height, [width] its width as a share of the frame's
/// width, and [size] the font size as a share of the frame's width — the same
/// unit the editor previews it in (`cqw`).
///
/// The text is a live layer, not burned into the video, which is what lets a
/// reel's wording be corrected without re-uploading anything.
class ReelOverlay {
  const ReelOverlay({
    required this.id,
    required this.text,
    required this.x,
    required this.y,
    required this.width,
    required this.size,
    this.style = ReelOverlayStyle.body,
    this.color = ReelOverlayColor.light,
    this.align = ReelOverlayAlign.center,
  });

  /// The bounds the API enforces. Repeated here so a value that got past it —
  /// a hand edit in Prisma Studio, say — cannot make a box vanish or fill the
  /// screen.
  static const double minWidth = 5;
  static const double maxSize = 30;
  static const double minSize = 1;

  final String id;
  final String text;
  final double x;
  final double y;
  final double width;
  final double size;
  final ReelOverlayStyle style;
  final ReelOverlayColor color;
  final ReelOverlayAlign align;

  factory ReelOverlay.fromJson(Json json) => ReelOverlay(
        id: asString(json['id']),
        text: asString(json['text']),
        x: asDouble(json['x']).clamp(0, 100).toDouble(),
        y: asDouble(json['y']).clamp(0, 100).toDouble(),
        width: asDouble(json['width'], 80).clamp(minWidth, 100).toDouble(),
        size: asDouble(json['size'], 6).clamp(minSize, maxSize).toDouble(),
        style: ReelOverlayStyle.parse(json['style']),
        color: ReelOverlayColor.parse(json['color']),
        align: ReelOverlayAlign.parse(json['align']),
      );

  /// Parses the reel's `overlays` array, dropping boxes with nothing to show.
  static List<ReelOverlay> listFrom(dynamic value) =>
      asList(value, ReelOverlay.fromJson).where((overlay) => overlay.text.trim().isNotEmpty).toList();
}
