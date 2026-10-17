/// Paths of the images bundled with the app.
///
/// The launcher icons are not here: they are native resources, written by
/// `tool/generate_app_icons.py` from `assets/hariharibol.png` — which is why
/// that file is in the repo but not in `pubspec.yaml`.
abstract final class AppAssets {
  /// The brand logo on a transparent ground. Every place the app draws its own
  /// logo uses this one picture.
  static const String logo = 'assets/hariharibol_trprt.png';

  /// The peacock feather on the Reels screen's title chip, in its own colours (`PeacockFeatherIcon`).
  static const String peacockFeather = 'assets/peacock_feather.svg';

  /// Sakha's icon — the centre button of the nav bar, the chat avatar and the
  /// welcome (`SakhaIcon`). One file: replacing `assets/sakha_icon.svg` changes
  /// all three, in its own colours in both themes.
  static const String sakhaIcon = 'assets/sakha_icon.svg';
}
