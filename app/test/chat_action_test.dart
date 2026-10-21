// What Sakha offers to open: the `action` event is read into a place the app can name, anything it cannot use is
// dropped, and each place leads to the right route.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/core/navigation/chat_action_route.dart';
import 'package:hariharibol/models/chat.dart';

ChatAction? offer(String json) => (ChatStreamEvent.parse('action', json) as ChatActionOffer?)?.action;

void main() {
  test('a page is offered by its name', () {
    final action = offer('{"type":"page","page":"reels"}')!;
    expect(action.type, ChatActionType.page);
    expect(action.page, ChatActionPage.reels);
    expect(chatActionRoute(action), (path: AppRoutes.reels, isTab: true));
  });

  test('a mantra leads to its own screen', () {
    final action = offer('{"type":"mantra","slug":"pranava-om","title":"Om"}')!;
    expect(action.title, 'Om');
    expect(chatActionRoute(action), (path: AppRoutes.mantraPath('pranava-om'), isTab: false));
  });

  test('a verse leads to its chapter, scrolled to the verse', () {
    final gita = offer('{"type":"verse","bookSlug":"bhagavad-gita","canto":null,"chapter":2,"verse":47,"title":"Bhagavad Gita 2.47"}')!;
    expect(chatActionRoute(gita).path, AppRoutes.chapterPath('bhagavad-gita', 2, verse: 47));
    final sb = offer('{"type":"verse","bookSlug":"srimad-bhagavatam","canto":1,"chapter":2,"verse":6}')!;
    expect(chatActionRoute(sb).path, AppRoutes.chapterPath('srimad-bhagavatam', 2, canto: 1, verse: 6));
    expect(chatActionRoute(sb).isTab, isFalse);
  });

  test('an offer this app cannot open is not shown', () {
    expect(ChatStreamEvent.parse('action', '{"type":"page","page":"admin"}'), isNull);
    expect(ChatStreamEvent.parse('action', '{"type":"mantra"}'), isNull);
    expect(ChatStreamEvent.parse('action', '{"type":"verse","bookSlug":"x","chapter":0,"verse":1}'), isNull);
    expect(ChatStreamEvent.parse('action', '{"type":"something-new"}'), isNull);
  });

  test('every page the server may offer is known to the app', () {
    for (final name in ['home', 'jap', 'reels', 'read', 'routine', 'settings', 'plans', 'search']) {
      expect(ChatActionPage.parse(name), isNotNull, reason: name);
    }
  });
}
