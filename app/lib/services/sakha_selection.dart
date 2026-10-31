import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../core/constants/chat_config.dart';
import '../core/navigation/app_routes.dart';
import 'push_link.dart';

/// "Ask Sakha" in the menu that opens when text is selected in another app.
///
/// Android only: the `AskSakhaSelection` alias in the manifest adds the item to
/// that menu and opens `MainActivity`, and iOS does not let an app add to it.
/// The native side keeps the selected text until this asks for it
/// ([takeSelectedText]), and says so when a new one arrives while the app is
/// already open ([selectionChanged]).
///
/// The text is not sent. It goes into the chat's box, so the reader can add a
/// question and decides when a message is charged.
class SakhaSelection {
  SakhaSelection._() : _open = PushLinks.instance.openRoute;

  @visibleForTesting
  SakhaSelection.test(this._open);

  static final SakhaSelection instance = SakhaSelection._();

  static const MethodChannel _channel = MethodChannel('hariharibol/selection');

  /// Where the chat route goes. Defaults to the push holder, so a selection
  /// made before sign-in waits for the dashboard like a tapped notification.
  final void Function(String route) _open;
  bool _started = false;

  /// Starts listening. Safe to call more than once; does nothing off Android.
  Future<void> start() async {
    if (_started || kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    _started = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'selectionChanged') await _take();
    });
    await _take();
  }

  /// Takes the held selection, if there is one, and opens the chat with it.
  Future<void> _take() async {
    final String? text;
    try {
      text = await _channel.invokeMethod<String>('takeSelectedText');
    } on PlatformException {
      return;
    } on MissingPluginException {
      // A test or a host without the channel: nothing was selected for us.
      return;
    }
    final route = routeFor(text);
    if (route != null) _open(route);
  }

  /// The route that opens the chat with [text] in its box, or null when there
  /// is nothing to put there.
  @visibleForTesting
  static String? routeFor(String? text) {
    final clipped = clip(text ?? '');
    if (clipped.isEmpty) return null;
    return AppRoutes.chatDraftPath(clipped);
  }

  /// The selection without its outer spaces, cut to what the chat's box takes.
  @visibleForTesting
  static String clip(String text) {
    final trimmed = text.trim();
    if (trimmed.length <= ChatConfig.fallbackMaxInputChars) return trimmed;
    var cut = trimmed.substring(0, ChatConfig.fallbackMaxInputChars);
    // An emoji is two code units; never leave the first half of one at the end.
    final last = cut.codeUnitAt(cut.length - 1);
    if (last >= 0xD800 && last <= 0xDBFF) cut = cut.substring(0, cut.length - 1);
    return cut;
  }
}
