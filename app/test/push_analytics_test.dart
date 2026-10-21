import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/push_analytics.dart';

/// A stopwatch that says whatever it is told, so a reading takes no real time.
class _FakeStopwatch implements Stopwatch {
  _FakeStopwatch(this.elapsed);

  @override
  Duration elapsed;

  @override
  void start() {}

  @override
  void stop() {}

  @override
  int get elapsedMilliseconds => elapsed.inMilliseconds;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<Map<String, dynamic>> sent;
  late bool failing;

  PushAnalytics make({Duration stay = const Duration(seconds: 42)}) => PushAnalytics.withSender(
        (events) async {
          if (failing) throw Exception('offline');
          sent.addAll(events);
        },
        stopwatch: () => _FakeStopwatch(stay),
      );

  setUp(() {
    sent = [];
    failing = false;
  });

  List<String> kinds() => sent.map((e) => e['event'] as String).toList();

  test('a push with no pushId reports nothing', () async {
    final analytics = make();
    analytics.delivered({'type': 'SLOKA'});
    analytics.opened({'type': 'SLOKA'});
    await Future<void>.delayed(Duration.zero);
    expect(sent, isEmpty);
  });

  test('arriving twice is reported once', () async {
    final analytics = make();
    analytics.delivered({'pushId': 'p1'});
    analytics.delivered({'pushId': 'p1'});
    await Future<void>.delayed(Duration.zero);
    expect(kinds(), ['DELIVERED']);
  });

  test('a tap counts as delivered, opened, then the time spent reading', () async {
    final analytics = make();
    analytics.opened({'pushId': 'p1'}, screen: '/library/bhagavad-gita/chapters/2?verse=47');
    analytics.endReading();
    await Future<void>.delayed(Duration.zero);

    expect(kinds(), ['DELIVERED', 'OPENED', 'ENGAGED']);
    final engaged = sent.last;
    expect(engaged['durationMs'], 42000);
    expect(engaged['screen'], '/library/bhagavad-gita/chapters/2?verse=47');
    expect(engaged['pushId'], 'p1');
  });

  test('a glance of under a second is not a reading', () async {
    final analytics = make(stay: const Duration(milliseconds: 400));
    analytics.opened({'pushId': 'p1'});
    analytics.endReading();
    await Future<void>.delayed(Duration.zero);
    expect(kinds(), ['DELIVERED', 'OPENED']);
  });

  test('a report that cannot be sent is kept and goes with the next one', () async {
    final analytics = make();
    failing = true;
    analytics.delivered({'pushId': 'p1'});
    await Future<void>.delayed(Duration.zero);
    expect(sent, isEmpty);

    failing = false;
    analytics.delivered({'pushId': 'p2'});
    await Future<void>.delayed(Duration.zero);
    expect(sent.map((e) => e['pushId']), ['p1', 'p2']);
  });
}
