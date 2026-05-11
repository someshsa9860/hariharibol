import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/data/models/chanting_model.dart';
import '../providers/chanting_providers.dart';
import '../widgets/streak_badge.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

const _periods = ['today', 'week', 'month', 'all'];
const _periodLabels = {
  'today': 'Today',
  'week': 'This Week',
  'month': 'This Month',
  'all': 'All Time',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
class ChantHistoryPage extends ConsumerStatefulWidget {
  const ChantHistoryPage({super.key});

  @override
  ConsumerState<ChantHistoryPage> createState() => _ChantHistoryPageState();
}

class _ChantHistoryPageState extends ConsumerState<ChantHistoryPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _periods.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Chant History',
          style: TextStyle(
            color: _textDark,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: _saffron,
          indicatorWeight: 3,
          labelColor: _saffron,
          unselectedLabelColor: _textMid,
          labelStyle: const TextStyle(
              fontWeight: FontWeight.bold, fontSize: 13),
          unselectedLabelStyle: const TextStyle(fontSize: 13),
          tabs: _periods
              .map((p) => Tab(text: _periodLabels[p]))
              .toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: _periods
            .map((p) => _HistoryTabView(period: p))
            .toList(),
      ),
    );
  }
}

// ─── Tab Content ──────────────────────────────────────────────────────────────
class _HistoryTabView extends ConsumerWidget {
  final String period;
  const _HistoryTabView({required this.period});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(chantHistoryProvider(period));
    final statsAsync = ref.watch(chantingStatsProvider);
    final streakAsync = ref.watch(chantingStreakProvider);

    return RefreshIndicator(
      color: _saffron,
      onRefresh: () async {
        ref.invalidate(chantHistoryProvider(period));
        ref.invalidate(chantingStatsProvider);
        ref.invalidate(chantingStreakProvider);
        await Future.wait([
          ref.read(chantHistoryProvider(period).future),
          ref.read(chantingStatsProvider.future),
        ]);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Stats row
                _StatsRow(
                  statsAsync: statsAsync,
                  streakAsync: streakAsync,
                  period: period,
                ),
                // Heatmap (only on 'all' and 'month')
                if (period == 'all' || period == 'month') ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                    child: Text(
                      'Chanting Activity',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: _textDark,
                          ),
                    ),
                  ),
                  statsAsync.when(
                    loading: () => const _HeatmapPlaceholder(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (stats) => _HeatmapCalendar(
                      dailyStats: stats.dailyStats,
                    ),
                  ),
                ],
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
                  child: Text(
                    'Sessions',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: _textDark,
                        ),
                  ),
                ),
              ],
            ),
          ),
          historyAsync.when(
            loading: () => const SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(_saffron),
                  ),
                ),
              ),
            ),
            error: (_, __) => SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_off_rounded,
                          color: _textMid, size: 40),
                      const SizedBox(height: 8),
                      const Text('Could not load history',
                          style: TextStyle(color: _textMid)),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () =>
                            ref.invalidate(chantHistoryProvider(period)),
                        child: const Text('Retry',
                            style: TextStyle(color: _saffron)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            data: (logs) => logs.isEmpty
                ? const SliverToBoxAdapter(child: _EmptyHistory())
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _LogTile(log: logs[i]),
                      childCount: logs.length,
                    ),
                  ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
        ],
      ),
    );
  }
}

// ─── Stats Row ────────────────────────────────────────────────────────────────
class _StatsRow extends StatelessWidget {
  final AsyncValue<ChantStatsModel> statsAsync;
  final AsyncValue<ChantStreakModel> streakAsync;
  final String period;

  const _StatsRow({
    required this.statsAsync,
    required this.streakAsync,
    required this.period,
  });

  @override
  Widget build(BuildContext context) {
    final totalChants = statsAsync.maybeWhen(
      data: (s) => period == 'today'
          ? (s.dailyStats[_todayKey()] ?? 0)
          : s.totalChants,
      orElse: () => 0,
    );
    final streak = streakAsync.maybeWhen(
      data: (s) => s.currentStreak,
      orElse: () => 0,
    );
    final sessions = statsAsync.maybeWhen(
      data: (s) => s.totalSessions,
      orElse: () => 0,
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _StatCard(
              emoji: '📿',
              value: _formatNum(totalChants),
              label: 'Chants',
              gradient: [_saffron, _saffronDeep],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _StatCard(
              emoji: '🔥',
              value: '$streak',
              label: 'Day Streak',
              gradient: [_krishnaBlue, const Color(0xFF0D3566)],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _StatCard(
              emoji: '⏱️',
              value: '$sessions',
              label: 'Sessions',
              gradient: [_gold, const Color(0xFFA0742A)],
            ),
          ),
        ],
      ),
    );
  }

  String _todayKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  String _formatNum(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }
}

class _StatCard extends StatelessWidget {
  final String emoji;
  final String value;
  final String label;
  final List<Color> gradient;

  const _StatCard({
    required this.emoji,
    required this.value,
    required this.label,
    required this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: gradient.first.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

// ─── Heatmap Calendar ─────────────────────────────────────────────────────────
class _HeatmapCalendar extends StatelessWidget {
  final Map<String, int> dailyStats;

  const _HeatmapCalendar({required this.dailyStats});

  static const _days = 35;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final cells = <_HeatCell>[];

    for (int i = _days - 1; i >= 0; i--) {
      final date = now.subtract(Duration(days: i));
      final key =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final count = dailyStats[key] ?? 0;
      cells.add(_HeatCell(date: date, count: count));
    }

    final int maxCount = cells.fold(
      0,
      (prev, c) => c.count > prev ? c.count : prev,
    );

    // Group by week rows (7 columns)
    final rows = <List<_HeatCell>>[];
    for (int r = 0; r < (_days / 7).ceil(); r++) {
      final start = r * 7;
      final end = (start + 7).clamp(0, cells.length);
      rows.add(cells.sublist(start, end));
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day-of-week header
          Row(
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) {
              return Expanded(
                child: Center(
                  child: Text(
                    d,
                    style: const TextStyle(
                      color: _textMid,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 6),
          ...rows.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: row.map((cell) {
                  return Expanded(
                    child: AspectRatio(
                      aspectRatio: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(2),
                        child: _HeatSquare(
                          cell: cell,
                          maxCount: maxCount,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Legend
          Row(
            children: [
              const Text('Less',
                  style: TextStyle(color: _textMid, fontSize: 10)),
              const SizedBox(width: 4),
              ...[0.0, 0.25, 0.5, 0.75, 1.0].map(
                (level) => Container(
                  width: 12,
                  height: 12,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    color: _heatColor(level),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Text('More',
                  style: TextStyle(color: _textMid, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  static Color _heatColor(double intensity) {
    if (intensity <= 0) return Colors.grey.withOpacity(0.15);
    if (intensity < 0.33) return _saffron.withOpacity(0.3);
    if (intensity < 0.66) return _saffron.withOpacity(0.6);
    return _saffronDeep;
  }
}

class _HeatCell {
  final DateTime date;
  final int count;
  const _HeatCell({required this.date, required this.count});
}

class _HeatSquare extends StatelessWidget {
  final _HeatCell cell;
  final int maxCount;

  const _HeatSquare({required this.cell, required this.maxCount});

  @override
  Widget build(BuildContext context) {
    final intensity =
        maxCount > 0 ? (cell.count / maxCount).clamp(0.0, 1.0) : 0.0;
    final isToday = _isSameDay(cell.date, DateTime.now());

    return Tooltip(
      message: '${_formatDate(cell.date)}: ${cell.count} chants',
      child: Container(
        decoration: BoxDecoration(
          color: _HeatmapCalendar._heatColor(intensity),
          borderRadius: BorderRadius.circular(3),
          border: isToday
              ? Border.all(color: _saffron, width: 1.5)
              : null,
        ),
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _formatDate(DateTime d) =>
      '${d.day}/${d.month}/${d.year}';
}

class _HeatmapPlaceholder extends StatelessWidget {
  const _HeatmapPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      height: 130,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}

// ─── Log Tile ─────────────────────────────────────────────────────────────────
class _LogTile extends StatelessWidget {
  final ChantLogModel log;
  const _LogTile({required this.log});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_saffron, _saffronDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                '${log.count}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  log.mantraId,
                  style: const TextStyle(
                    color: _textDark,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.schedule_rounded,
                        color: _textMid, size: 12),
                    const SizedBox(width: 4),
                    Text(
                      _formatDate(log.date),
                      style: const TextStyle(
                          color: _textMid, fontSize: 12),
                    ),
                    if (log.durationSeconds != null) ...[
                      const SizedBox(width: 10),
                      const Icon(Icons.timer_outlined,
                          color: _textMid, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        _formatDuration(log.durationSeconds!),
                        style: const TextStyle(
                            color: _textMid, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _saffron.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${log.count} chants',
              style: const TextStyle(
                color: _saffronDeep,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) {
    const months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[d.month]} ${d.day}, ${d.year}';
  }

  String _formatDuration(int secs) {
    if (secs < 60) return '${secs}s';
    final m = secs ~/ 60;
    final s = secs % 60;
    return '${m}m ${s}s';
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────
class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 32),
      child: Column(
        children: [
          const Text('📿', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          const Text(
            'No chanting sessions yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _textDark,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Start chanting to see your history and progress here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _textMid, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => context.pop(),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [_saffron, _saffronDeep]),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Start Chanting',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
