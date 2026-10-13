// What the routine sync works out on the phone: what changed since the last
// sync, how to cut a large change into requests, and what the routine is once
// the server has answered.

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/models/routine_data.dart';
import 'package:hariharibol/models/routine_sync.dart';
import 'package:hariharibol/models/routine_task.dart';

const today = '2026-10-15';
const since = '2026-06-17';

RoutineTask task(
  String id, {
  String day = today,
  String title = 'Scripture reading',
  int? doneAt,
  RoutineWindow? window,
}) => RoutineTask(
  id: id,
  title: title,
  day: day,
  window: window,
  isDone: doneAt != null,
  doneAt: doneAt,
);

DailyRoutineItem item(String id, {String since = '2026-10-01', String until = ''}) =>
    DailyRoutineItem(id: id, title: 'Japa', since: since, until: until);

List<String> ids(Iterable<RoutineTask> tasks) => [for (final each in tasks) each.id];

void main() {
  group('RoutineChanges.between', () {
    test('a routine that has not changed has no changes', () {
      final routine = RoutineData(
        tasks: [task('t1')],
        daily: [item('d1')],
        checks: const {today: {'d1': 400}},
      );

      expect(RoutineChanges.between(routine, routine).isEmpty, isTrue);
    });

    test('a new task is sent and an unchanged one is not', () {
      final before = RoutineData(tasks: [task('t1')]);
      final after = RoutineData(tasks: [task('t1'), task('t2')]);

      expect(ids(RoutineChanges.between(before, after).tasks), ['t2']);
    });

    test('an edited task is sent whole', () {
      final before = RoutineData(tasks: [task('t1')]);
      final after = RoutineData(tasks: [task('t1', title: 'Evening reading', doneAt: 700)]);

      final changes = RoutineChanges.between(before, after);

      expect(changes.tasks.single.title, 'Evening reading');
      expect(changes.tasks.single.doneAt, 700);
      expect(changes.removedTasks, isEmpty);
    });

    test('a task that is gone is a removal', () {
      final before = RoutineData(tasks: [task('t1'), task('t2')]);
      final after = RoutineData(tasks: [task('t2')]);

      expect(RoutineChanges.between(before, after).removedTasks, ['t1']);
    });

    test('a tick, a new tick time and an untick', () {
      const before = RoutineData(checks: {today: {'d1': 400, 'd2': 500}});
      const after = RoutineData(checks: {today: {'d1': 450, 'd3': 600}});

      final changes = RoutineChanges.between(before, after);

      expect(
        {for (final check in changes.checks) check.itemId: check.doneAt},
        {'d1': 450, 'd3': 600},
      );
      expect(changes.removedChecks, [(day: today, itemId: 'd2')]);
    });

    test('ending a daily item is an edit of it, never a removal', () {
      final before = RoutineData(daily: [item('d1')]);
      final after = RoutineData(daily: [item('d1', until: '2026-10-14')]);

      final changes = RoutineChanges.between(before, after);

      expect(changes.daily.single.until, '2026-10-14');
      expect(changes.removedTasks, isEmpty);
    });

    test('applying the changes to the first routine gives the second', () {
      final before = RoutineData(
        tasks: [task('t1'), task('t2'), task('t3')],
        daily: [item('d1')],
        checks: const {today: {'d1': 400, 'd2': 500}},
      );
      final after = RoutineData(
        tasks: [task('t1', doneAt: 420), task('t3'), task('t4', day: '2026-10-16')],
        daily: [item('d1', until: '2026-10-14'), item('d5')],
        checks: const {
          today: {'d1': 450},
          '2026-10-16': {'d5': null},
        },
      );

      final result = RoutineChanges.between(before, after).applyTo(before);

      expect(result.sameAs(after), isTrue);
    });
  });

  group('RoutineChanges.chunked', () {
    test('a change that fits goes as it is', () {
      final changes = RoutineChanges(tasks: [task('t1')]);

      expect(changes.chunked(RoutineConfig.syncChunkRows), hasLength(1));
    });

    test('nothing to send is still one request, to read with', () {
      final pieces = const RoutineChanges().chunked(RoutineConfig.syncChunkRows);

      expect(pieces, hasLength(1));
      expect(pieces.single.isEmpty, isTrue);
    });

    test('a large change is cut into pieces and nothing is lost', () {
      final changes = RoutineChanges(
        tasks: [for (var i = 0; i < 1300; i++) task('t$i')],
        daily: [item('d1')],
        checks: [const RoutineCheck(itemId: 'd1', day: today, doneAt: 400)],
        removedTasks: const ['gone1', 'gone2'],
        removedChecks: const [(day: today, itemId: 'd9')],
      );

      final pieces = changes.chunked(RoutineConfig.syncChunkRows);

      expect(pieces, hasLength(3));
      expect(pieces.every((piece) => piece.rows <= RoutineConfig.syncChunkRows), isTrue);
      expect(pieces.fold<int>(0, (sum, piece) => sum + piece.rows), changes.rows);

      final rebuilt = pieces.fold(const RoutineData(), (data, piece) => piece.applyTo(data));
      expect(rebuilt.tasks, hasLength(1300));
      expect(rebuilt.daily, hasLength(1));
      expect(rebuilt.checks[today], {'d1': 400});
    });
  });

  group('RoutineChanges.toJson', () {
    test('a name the server would refuse is cut to what it takes', () {
      final changes = RoutineChanges(tasks: [task('t1', title: '  ${'a' * 300}  ')]);

      final body = changes.toJson(since);

      expect(body['since'], since);
      final title = (body['tasks'] as List).single['title'] as String;
      expect(title.length, RoutineConfig.maxTitleLength);
    });

    test('a removed tick names the item and the day', () {
      final body = const RoutineChanges(
        removedChecks: [(day: today, itemId: 'd2')],
      ).toJson(since);

      expect(body['removedChecks'], [
        {'itemId': 'd2', 'day': today},
      ]);
    });
  });

  group('routineTitle', () {
    test('is trimmed', () => expect(routineTitle('  Japa \n'), 'Japa'));

    test('is cut to the length the backend takes', () {
      expect(routineTitle('x' * 500).length, RoutineConfig.maxTitleLength);
    });

    test('does not split a character made of two halves', () {
      final title = '${'x' * (RoutineConfig.maxTitleLength - 1)}🙏🙏';

      final cut = routineTitle(title);

      expect(cut.length, RoutineConfig.maxTitleLength - 1);
      expect(cut.codeUnits.last, 'x'.codeUnitAt(0));
    });
  });

  group('mergeSynced', () {
    test('the server\'s days replace the phone\'s: an arrival comes, a removal goes', () {
      final phone = RoutineData(tasks: [task('mine'), task('removedElsewhere')]);
      final server = RoutineData(tasks: [task('mine'), task('fromAnotherPhone')]);

      final result = mergeSynced(sent: phone, now: phone, server: server, since: since);

      expect(ids(result.merged.tasks), ['mine', 'fromAnotherPhone']);
      expect(ids(result.base.tasks), ['mine', 'fromAnotherPhone']);
    });

    test('days before the window stay on the phone, and in the base', () {
      final phone = RoutineData(
        tasks: [task('old', day: '2025-01-01'), task('recent')],
        checks: const {
          '2025-01-01': {'d1': 400},
          today: {'d1': 450},
        },
      );
      final server = RoutineData(
        tasks: [task('recent')],
        checks: const {today: {'d1': 450}},
      );

      final result = mergeSynced(sent: phone, now: phone, server: server, since: since);

      expect(ids(result.merged.tasks), containsAll(['old', 'recent']));
      expect(result.merged.checks['2025-01-01'], {'d1': 400});
      expect(ids(result.base.tasks), containsAll(['old', 'recent']));
      expect(RoutineChanges.between(result.base, result.merged).isEmpty, isTrue);
    });

    test('an edit made while the request was away is laid back on top', () {
      final sent = RoutineData(tasks: [task('t1')]);
      final now = RoutineData(tasks: [task('t1', doneAt: 480), task('typedMeanwhile')]);
      final server = RoutineData(tasks: [task('t1'), task('fromAnotherPhone')]);

      final result = mergeSynced(sent: sent, now: now, server: server, since: since);

      expect(ids(result.merged.tasks), ['t1', 'fromAnotherPhone', 'typedMeanwhile']);
      expect(result.merged.tasks.first.doneAt, 480);
      // The base is the server's word, so those edits are still to be sent.
      final owed = RoutineChanges.between(result.base, result.merged);
      expect(ids(owed.tasks), ['t1', 'typedMeanwhile']);
    });

    test('a task removed while the request was away stays removed', () {
      final sent = RoutineData(tasks: [task('t1'), task('t2')]);
      final now = RoutineData(tasks: [task('t2')]);
      final server = RoutineData(tasks: [task('t1'), task('t2')]);

      final result = mergeSynced(sent: sent, now: now, server: server, since: since);

      expect(ids(result.merged.tasks), ['t2']);
      expect(RoutineChanges.between(result.base, result.merged).removedTasks, ['t1']);
    });
  });
}
