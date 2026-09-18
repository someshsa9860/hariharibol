import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../models/routine_task.dart';
import '../services/local_store.dart';

String _today() {
  final now = DateTime.now();
  final month = now.month.toString().padLeft(2, '0');
  final day = now.day.toString().padLeft(2, '0');
  return '${now.year}-$month-$day';
}

/// Today's routine — devotion, work and the ordinary errands between them.
///
/// Device-only for now: there is no backend model for a personal task list
/// yet. A new day carries over whatever was left unfinished and drops what
/// was already checked off, so the list is never silently lost but also
/// never turns into a lifetime of clutter.
class RoutineNotifier extends Notifier<List<RoutineTask>> {
  @override
  List<RoutineTask> build() {
    final stored =
        (LocalStore.instance.read<List>(BoxKeys.routineTasks) ?? const [])
            .whereType<Map>()
            .map(
              (json) => RoutineTask.fromJson(Map<String, dynamic>.from(json)),
            )
            .toList();

    final today = _today();
    if (LocalStore.instance.read<String>(BoxKeys.routineDate) == today) {
      return stored;
    }

    final carried = stored.where((task) => !task.isDone).toList();
    unawaited(_persist(carried, today));
    return carried;
  }

  Future<void> _persist(List<RoutineTask> tasks, String date) async {
    await LocalStore.instance.write(
      BoxKeys.routineTasks,
      tasks.map((task) => task.toJson()).toList(),
    );
    await LocalStore.instance.write(BoxKeys.routineDate, date);
  }

  Future<void> add({
    required String title,
    required RoutineCategory category,
    required RoutineSlot slot,
  }) async {
    final task = RoutineTask(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      title: title,
      category: category,
      slot: slot,
    );
    state = [...state, task];
    await _persist(state, _today());
  }

  Future<void> toggle(String id) async {
    state = [
      for (final task in state)
        if (task.id == id) task.copyWith(isDone: !task.isDone) else task,
    ];
    await _persist(state, _today());
  }

  Future<void> remove(String id) async {
    state = state.where((task) => task.id != id).toList();
    await _persist(state, _today());
  }

  /// Puts a removed task back, for the snack bar's undo action.
  Future<void> restore(RoutineTask task) async {
    state = [...state, task];
    await _persist(state, _today());
  }
}

final routineProvider = NotifierProvider<RoutineNotifier, List<RoutineTask>>(
  RoutineNotifier.new,
);
