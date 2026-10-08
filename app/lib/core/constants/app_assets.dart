/// Paths of the images bundled with the app.
///
/// The launcher icons are not here: they are native resources, written by
/// `tool/generate_app_icons.py` from `assets/hariharibol.png` — which is why
/// that file is in the repo but not in `pubspec.yaml`.
abstract final class AppAssets {
  /// The brand logo on a transparent ground. Every place the app draws its own
  /// logo uses this one picture.
  static const String logo = 'assets/hariharibol_trprt.png';
}
