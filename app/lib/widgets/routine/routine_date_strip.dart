import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/routine_config.dart';
import '../../models/routine_task.dart';
import '../../providers/routine_provider.dart';
import 'routine_day_chip.dart';

/// A scrollable row of days — a few months back, a couple ahead — with the
/// selected one centred. Tapping a day shows its routine; scrolling back is how
/// old days are looked at.
class RoutineDateStrip extends ConsumerStatefulWidget {
  const RoutineDateStrip({super.key});

  @override
  ConsumerState<RoutineDateStrip> createState() => _RoutineDateStripState();
}

class _RoutineDateStripState extends ConsumerState<RoutineDateStrip> {
  static const int _count = RoutineConfig.pastDays + 1 + RoutineConfig.futureDays;

  final _controller = ScrollController();
  final _ekadashi = <int, bool>{};
  late final DateTime _today = routineDay(DateTime.now());

  DateTime _dayAt(int index) => DateTime(
    _today.year,
    _today.month,
    _today.day + index - RoutineConfig.pastDays,
  );

  // Through UTC, so a daylight-saving day of 23 or 25 hours still counts as one.
  int _indexOf(DateTime day) =>
      DateTime.utc(day.year, day.month, day.day)
          .difference(DateTime.utc(_today.year, _today.month, _today.day))
          .inDays +
      RoutineConfig.pastDays;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _centre(animate: false));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _centre({required bool animate}) {
    if (!mounted || !_controller.hasClients) return;
    final position = _controller.position;
    final index = _indexOf(ref.read(selectedRoutineDayProvider));
    final target =
        (index * RoutineConfig.dayExtent -
                (position.viewportDimension - RoutineConfig.dayExtent) / 2)
            .clamp(position.minScrollExtent, position.maxScrollExtent);
    if (animate) {
      _controller.animateTo(
        target,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    } else {
      _controller.jumpTo(target);
    }
  }

  bool _isEkadashi(int index) => _ekadashi.putIfAbsent(
    index,
    () => ref.read(ekadashiCalendarProvider).isEkadashi(_dayAt(index)),
  );

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedRoutineDayProvider);

    // Tapping "today" or a day near the edge should bring it to the middle.
    ref.listen(selectedRoutineDayProvider, (_, _) => _centre(animate: true));

    return SizedBox(
      height: RoutineConfig.stripHeight,
      child: ListView.builder(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        itemExtent: RoutineConfig.dayExtent,
        itemCount: _count,
        itemBuilder: (context, index) {
          final day = _dayAt(index);
          return RoutineDayChip(
            day: day,
            isSelected: day == selected,
            isToday: day == _today,
            isEkadashi: _isEkadashi(index),
            onTap: () => ref.read(selectedRoutineDayProvider.notifier).select(day),
          );
        },
      ),
    );
  }
}
