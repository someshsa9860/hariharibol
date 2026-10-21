import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/calendar.dart';
import '../../providers/calendar_provider.dart';
import '../../widgets/calendar/calendar_glyph.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// The Hindu calendar: a month at a time, each day with its tithi and the
/// Ekadashi, Chaturthi or festival drawn on it, and the chosen day's panchang
/// below. Worked out by the server for one place (`backend/services/panchang.js`).
class CalendarView extends ConsumerStatefulWidget {
  const CalendarView({super.key});

  @override
  ConsumerState<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends ConsumerState<CalendarView> {
  late DateTime _month;
  String? _selected;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  void _move(int by) => setState(() {
        _month = DateTime(_month.year, _month.month + by);
        _selected = null;
      });

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final range = ref.watch(calendarMonthProvider(_month));

    return Scaffold(
      appBar: AppBar(title: Text(text.calendarTitle, style: context.texts.headlineSmall)),
      body: range.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.refresh(calendarMonthProvider(_month).future),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.refresh(calendarMonthProvider(_month).future),
          child: ListView(
            padding: AppSpacing.page,
            children: [
              _MonthBar(month: _month, onMove: _move),
              const SizedBox(height: AppSpacing.md),
              if (data.days.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                  child: Text(text.calendarEmpty, textAlign: TextAlign.center, style: context.texts.bodyMedium),
                )
              else ...[
                _MonthGrid(
                  month: _month,
                  range: data,
                  selected: _selected ?? (_isThisMonth(data.today) ? data.today : _key(_month, 1)),
                  onSelect: (date) => setState(() => _selected = date),
                ),
                const SizedBox(height: AppSpacing.lg),
                _DayCard(range: data, date: _selected ?? (_isThisMonth(data.today) ? data.today : _key(_month, 1))),
              ],
            ],
          ),
        ),
      ),
    );
  }

  bool _isThisMonth(String today) => today.startsWith(_key(_month, 1).substring(0, 7));
}

String _key(DateTime month, int day) =>
    '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

class _MonthBar extends StatelessWidget {
  const _MonthBar({required this.month, required this.onMove});

  final DateTime month;
  final void Function(int by) onMove;

  @override
  Widget build(BuildContext context) {
    final loc = MaterialLocalizations.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          tooltip: loc.previousMonthTooltip,
          onPressed: () => onMove(-1),
          icon: const Icon(Icons.chevron_left_rounded),
        ),
        Expanded(
          child: Text(loc.formatMonthYear(month), textAlign: TextAlign.center, style: context.texts.titleLarge),
        ),
        IconButton(
          tooltip: loc.nextMonthTooltip,
          onPressed: () => onMove(1),
          icon: const Icon(Icons.chevron_right_rounded),
        ),
      ],
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({required this.month, required this.range, required this.selected, required this.onSelect});

  final DateTime month;
  final CalendarRange range;
  final String selected;
  final void Function(String date) onSelect;

  @override
  Widget build(BuildContext context) {
    final loc = MaterialLocalizations.of(context);
    final length = DateTime(month.year, month.month + 1, 0).day;
    // Sunday first, as the printed panchangs have it. `DateTime.weekday` is 1 = Monday … 7 = Sunday.
    final lead = DateTime(month.year, month.month, 1).weekday % 7;
    final heads = loc.narrowWeekdays; // Sunday first
    final cells = <String?>[
      ...List<String?>.filled(lead, null),
      for (var d = 1; d <= length; d++) _key(month, d),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }

    return Column(
      children: [
        Row(
          children: [
            for (final head in heads)
              Expanded(
                child: Center(child: Text(head, style: context.texts.labelSmall)),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        for (var row = 0; row < cells.length ~/ 7; row++)
          Row(
            children: [
              for (final date in cells.sublist(row * 7, row * 7 + 7))
                Expanded(
                  child: date == null
                      ? const SizedBox(height: 64)
                      : _DayCell(
                          date: date,
                          day: range.dayOn(date),
                          festivals: range.festivalsOn(date).where((f) => !f.kind.isQuiet).toList(),
                          isToday: date == range.today,
                          isSelected: date == selected,
                          onTap: () => onSelect(date),
                        ),
                ),
            ],
          ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.day,
    required this.festivals,
    required this.isToday,
    required this.isSelected,
    required this.onTap,
  });

  final String date;
  final CalendarDay? day;
  final List<CalendarFestival> festivals;
  final bool isToday;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: isSelected,
      label: '${int.parse(date.substring(8))}${day == null ? '' : ', ${day!.tithi}'}'
          '${festivals.isEmpty ? '' : ', ${festivals.map((f) => f.name).join(', ')}'}',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          height: 64,
          margin: const EdgeInsets.all(1),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: isSelected ? colors.primaryContainer : null,
            border: isToday ? Border.all(color: colors.primary, width: 1.5) : null,
          ),
          child: ExcludeSemantics(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${int.parse(date.substring(8))}',
                  style: context.texts.titleSmall?.copyWith(fontWeight: isToday ? FontWeight.w700 : null),
                ),
                if (day != null)
                  Text(
                    '${day!.paksha}${day!.tithiNumber <= 15 ? day!.tithiNumber : day!.tithiNumber - 15}',
                    style: context.texts.labelSmall?.copyWith(color: colors.onSurfaceVariant),
                  ),
                SizedBox(
                  height: 16,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (final f in festivals.take(2)) CalendarGlyph(kind: f.kind, size: 14),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.range, required this.date});

  final CalendarRange range;
  final String date;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final loc = MaterialLocalizations.of(context);
    final day = range.dayOn(date);
    if (day == null) return const SizedBox.shrink();
    final festivals = range.festivalsOn(date);
    String clock(DateTime? t) => t == null ? '—' : loc.formatTimeOfDay(TimeOfDay.fromDateTime(t));

    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)),
              const SizedBox(width: AppSpacing.lg),
              Flexible(child: Text(value, textAlign: TextAlign.end, style: context.texts.bodyMedium)),
            ],
          ),
        );

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(loc.formatFullDate(DateTime.parse(date)), style: context.texts.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            // The panchang's own terms (tithi, nakshatra, the months) are Sanskrit names and are shown as the server sends them, like Ārta elsewhere.
            row('Tithi', '${day.isShukla ? 'Shukla' : 'Krishna'} ${day.tithi}'),
            row('Nakshatra', day.nakshatra),
            row('Yoga · Karana', '${day.yoga} · ${day.karana}'),
            row('${day.month}${day.isAdhika ? ' (Adhika)' : ''}', 'Vikram ${day.vikramSamvat}'),
            row('↑ ${clock(day.sunrise)}', '↓ ${clock(day.sunset)}'),
            if (day.notes != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(day.notes!, style: context.texts.bodySmall),
            ],
            for (final f in festivals) ...[
              const Divider(height: AppSpacing.xl),
              Row(
                children: [
                  CalendarGlyph(kind: f.kind, size: 24),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(f.name, style: context.texts.titleSmall),
                        if (f.vaishnavaDate != null) Text(text.calendarVaishnavaNote, style: context.texts.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
