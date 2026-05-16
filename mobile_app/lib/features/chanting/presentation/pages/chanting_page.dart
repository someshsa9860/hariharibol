import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/data/models/chanting_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';
import '../providers/chanting_providers.dart';

// ─── Sacred Palette ───────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF6B00);
const _saffronDeep = Color(0xFFD96100);
const _maroon = Color(0xFF7B1C1C);
const _peacock = Color(0xFF006B6B);
const _sandstone = Color(0xFFC4A882);
const _gold = Color(0xFFD4A055);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────
class ChantingPage extends ConsumerStatefulWidget {
  const ChantingPage({super.key});

  @override
  ConsumerState<ChantingPage> createState() => _ChantingPageState();
}

class _ChantingPageState extends ConsumerState<ChantingPage>
    with TickerProviderStateMixin {
  int _count = 0;
  static const int _target = 108;
  late final AnimationController _tapCtrl;
  late final Animation<double> _scaleAnim;
  late final AnimationController _rippleCtrl;
  late final Animation<double> _rippleAnim;
  final DateTime _sessionStart = DateTime.now();

  @override
  void initState() {
    super.initState();
    _tapCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(parent: _tapCtrl, curve: Curves.easeOut),
    );
    _rippleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _rippleAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _rippleCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _tapCtrl.dispose();
    _rippleCtrl.dispose();
    super.dispose();
  }

  void _onTap() {
    HapticFeedback.lightImpact();
    setState(() => _count++);
    _tapCtrl.forward().then((_) => _tapCtrl.reverse());
    _rippleCtrl.forward(from: 0.0);
    if (_count == _target) {
      HapticFeedback.heavyImpact();
      _showCompletionSnack();
    }
  }

  void _showCompletionSnack() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('🙏 Mala complete! 108 chants done!'),
        backgroundColor: _maroon,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _reset() async {
    if (_count == 0) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reset count?'),
        content: const Text('Current session count will be cleared.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reset', style: TextStyle(color: _saffron)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      HapticFeedback.mediumImpact();
      setState(() => _count = 0);
    }
  }

  Future<void> _saveSession() async {
    if (_count == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Chant at least once before saving'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final notes = await showDialog<String>(
      context: context,
      builder: (_) => _SaveNotesDialog(count: _count),
    );
    if (notes == null || !mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _SavingDialog(),
    );

    bool success = false;
    final savedCount = _count;
    try {
      final dio = ref.read(dioProvider);
      final secs = DateTime.now().difference(_sessionStart).inSeconds;
      await dio.post('/api/v1/chanting/logs', data: {
        'count': savedCount,
        'durationSeconds': secs,
        if (notes.isNotEmpty) 'notes': notes,
        'date': DateTime.now().toIso8601String(),
      });
      success = true;
    } catch (_) {}

    if (mounted) {
      Navigator.of(context).pop();
      ref.invalidate(chantingStatsProvider);
      ref.invalidate(chantingStreakProvider);
      ref.invalidate(weeklyChantLogsProvider);
      if (success) setState(() => _count = 0);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? '🙏 $savedCount chants saved!'
                : 'Saved locally — will sync when online',
          ),
          backgroundColor: success ? _peacock : _textMid,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_count / _target).clamp(0.0, 1.0);
    final statsAsync = ref.watch(chantingStatsProvider);
    final streakAsync = ref.watch(chantingStreakProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildAppBar(context),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              child: Column(
                children: [
                  _buildCounterCard(progress),
                  const SizedBox(height: 20),
                  _TodayStatsCard(
                    statsAsync: statsAsync,
                    streakAsync: streakAsync,
                  ),
                  const SizedBox(height: 20),
                  _WeeklyChartCard(
                    statsAsync: statsAsync,
                    streakAsync: streakAsync,
                    target: _target,
                  ),
                  const SizedBox(height: 20),
                  _BrowseMantrasButton(
                    onTap: () => context.push('/mantras'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  SliverAppBar _buildAppBar(BuildContext context) {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      floating: true,
      snap: true,
      title: Row(
        children: [
          const Text('📿', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 8),
          Text(
            'Daily Chanting',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: _saffron,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Georgia',
                ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.history_rounded, color: _textDark),
          onPressed: () => context.push('/chanting/history'),
          tooltip: 'History',
        ),
      ],
    );
  }

  Widget _buildCounterCard(double progress) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: _saffron.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // Japa ring
          SizedBox(
            width: 200,
            height: 200,
            child: CustomPaint(
              painter: _JapaRingPainter(progress: progress),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$_count',
                      style: const TextStyle(
                        fontSize: 56,
                        fontWeight: FontWeight.bold,
                        color: _textDark,
                        letterSpacing: -2,
                      ),
                    ),
                    Text(
                      'of $_target',
                      style: const TextStyle(
                        fontSize: 15,
                        color: _textMid,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 28),
          // TAP button with ripple
          AnimatedBuilder(
            animation: _scaleAnim,
            builder: (_, child) =>
                Transform.scale(scale: _scaleAnim.value, child: child),
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _rippleAnim,
                  builder: (_, __) => Container(
                    width: 120 + 80 * _rippleAnim.value,
                    height: 120 + 80 * _rippleAnim.value,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _saffron
                          .withOpacity(0.12 * (1 - _rippleAnim.value)),
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: _onTap,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [_saffron, _saffronDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: _saffron.withOpacity(0.45),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'TAP',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 3,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton.icon(
                onPressed: _reset,
                icon: const Icon(Icons.refresh_rounded,
                    size: 15, color: _textMid),
                label: const Text('Reset',
                    style: TextStyle(color: _textMid, fontSize: 13)),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: _saveSession,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _maroon,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 12),
                  elevation: 0,
                ),
                icon: const Icon(Icons.save_rounded, size: 15),
                label: const Text('Save Session',
                    style: TextStyle(fontSize: 13)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Japa Ring Painter ────────────────────────────────────────────────────────
class _JapaRingPainter extends CustomPainter {
  final double progress;
  const _JapaRingPainter({required this.progress});

  static const _strokeWidth = 14.0;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - _strokeWidth / 2 - 4;

    // Background ring (sandstone, muted)
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = _sandstone.withOpacity(0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = _strokeWidth,
    );

    if (progress > 0) {
      final sweepAngle = 2 * pi * progress;
      final rect = Rect.fromCircle(center: center, radius: radius);

      // Sweep gradient from saffron to maroon
      final shader = ui.Gradient.sweep(
        center,
        const [Color(0xFFFF6B00), Color(0xFFD96100), Color(0xFF7B1C1C)],
        null,
        TileMode.clamp,
        -pi / 2,
        3 * pi / 2,
      );

      canvas.drawArc(
        rect,
        -pi / 2,
        sweepAngle,
        false,
        Paint()
          ..shader = shader
          ..style = PaintingStyle.stroke
          ..strokeWidth = _strokeWidth
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_JapaRingPainter old) => old.progress != progress;
}

// ─── Today Stats Card ─────────────────────────────────────────────────────────
class _TodayStatsCard extends StatelessWidget {
  final AsyncValue<ChantStatsModel> statsAsync;
  final AsyncValue<ChantStreakModel> streakAsync;

  const _TodayStatsCard({
    required this.statsAsync,
    required this.streakAsync,
  });

  @override
  Widget build(BuildContext context) {
    final todayCount = statsAsync.maybeWhen(
      data: (s) => s.dailyStats[_dateKey(DateTime.now())] ?? 0,
      orElse: () => 0,
    );
    final streak = streakAsync.maybeWhen(
      data: (s) => s.currentStreak,
      orElse: () => 0,
    );
    final totalSessions = statsAsync.maybeWhen(
      data: (s) => s.totalSessions,
      orElse: () => 0,
    );

    return Container(
      padding: const EdgeInsets.all(18),
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
          const Text(
            "Today's Progress",
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: _textDark,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _InfoBlock(emoji: '📿', value: '$todayCount', label: 'Today'),
              _VerticalDivider(),
              _InfoBlock(
                  emoji: '🔥',
                  value: '$streak',
                  label: 'Day streak'),
              _VerticalDivider(),
              _InfoBlock(
                  emoji: '⏱️',
                  value: '$totalSessions',
                  label: 'Sessions'),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoBlock extends StatelessWidget {
  final String emoji;
  final String value;
  final String label;

  const _InfoBlock({
    required this.emoji,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _textDark,
            ),
          ),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: _textMid),
          ),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 40,
      color: _sandstone.withOpacity(0.3),
    );
  }
}

// ─── Weekly Chart Card ────────────────────────────────────────────────────────
class _WeeklyChartCard extends StatelessWidget {
  final AsyncValue<ChantStatsModel> statsAsync;
  final AsyncValue<ChantStreakModel> streakAsync;
  final int target;

  const _WeeklyChartCard({
    required this.statsAsync,
    required this.streakAsync,
    required this.target,
  });

  @override
  Widget build(BuildContext context) {
    final streak = streakAsync.maybeWhen(
      data: (s) => s.currentStreak,
      orElse: () => 0,
    );

    return Container(
      padding: const EdgeInsets.all(20),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Last 7 Days',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: _textDark,
                ),
              ),
              if (streak > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _maroon.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '🔥 $streak day${streak == 1 ? '' : 's'} streak',
                    style: const TextStyle(
                      color: _maroon,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          // Legend row
          Row(
            children: [
              _LegendDot(color: _gold, label: 'Target hit'),
              const SizedBox(width: 12),
              _LegendDot(color: _saffron, label: 'Partial'),
              const SizedBox(width: 12),
              _LegendDot(
                  color: _sandstone.withOpacity(0.4), label: 'No chants'),
            ],
          ),
          const SizedBox(height: 12),
          statsAsync.when(
            loading: () => const SizedBox(
              height: 90,
              child: Center(
                child: CircularProgressIndicator(
                  color: _saffron,
                  strokeWidth: 2,
                ),
              ),
            ),
            error: (_, __) => const SizedBox(height: 90),
            data: (stats) =>
                _BarChart(dailyStats: stats.dailyStats, target: target),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: _textMid)),
      ],
    );
  }
}

class _BarChart extends StatelessWidget {
  final Map<String, int> dailyStats;
  final int target;

  const _BarChart({required this.dailyStats, required this.target});

  static String _dateKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static String _weekdayLabel(int weekday) {
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return labels[(weekday - 1).clamp(0, 6)];
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final days = List.generate(7, (i) => now.subtract(Duration(days: 6 - i)));
    final counts = days.map((d) => dailyStats[_dateKey(d)] ?? 0).toList();

    final maxCount = counts.fold(0, (a, b) => a > b ? a : b);
    final displayMax =
        maxCount < target ? target.toDouble() : maxCount.toDouble();

    return SizedBox(
      height: 90,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(7, (i) {
          final count = counts[i];
          final barH =
              displayMax > 0 ? (count / displayMax * 64).clamp(2.0, 64.0) : 2.0;
          final isToday = i == 6;

          final Color barColor;
          if (count == 0) {
            barColor = _sandstone.withOpacity(0.35);
          } else if (count >= target) {
            barColor = _gold;
          } else {
            barColor = _saffron;
          }

          return Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 500),
                curve: Curves.easeOut,
                width: 24,
                height: barH,
                decoration: BoxDecoration(
                  color: barColor,
                  borderRadius: BorderRadius.circular(6),
                  border: isToday
                      ? Border.all(
                          color: _saffron.withOpacity(0.5), width: 1.5)
                      : null,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _weekdayLabel(days[i].weekday),
                style: TextStyle(
                  color: isToday ? _saffron : _textMid,
                  fontSize: 10,
                  fontWeight:
                      isToday ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}

// ─── Browse Mantras Button ────────────────────────────────────────────────────
class _BrowseMantrasButton extends StatelessWidget {
  final VoidCallback onTap;

  const _BrowseMantrasButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding:
            const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
        decoration: BoxDecoration(
          border: Border.all(color: _peacock, width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.library_music_rounded, color: _peacock, size: 20),
            SizedBox(width: 10),
            Text(
              'Browse Mantra Library',
              style: TextStyle(
                color: _peacock,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            SizedBox(width: 8),
            Icon(Icons.arrow_forward_rounded, color: _peacock, size: 18),
          ],
        ),
      ),
    );
  }
}

// ─── Save Notes Dialog ────────────────────────────────────────────────────────
class _SaveNotesDialog extends StatefulWidget {
  final int count;

  const _SaveNotesDialog({required this.count});

  @override
  State<_SaveNotesDialog> createState() => _SaveNotesDialogState();
}

class _SaveNotesDialogState extends State<_SaveNotesDialog> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          const Text('📿', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 8),
          Text(
            'Save ${widget.count} chants',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Add an optional note for this session',
            style: TextStyle(color: _textMid, fontSize: 13),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'e.g. Morning session, feeling peaceful...',
              hintStyle: const TextStyle(fontSize: 13, color: _textMid),
              filled: true,
              fillColor: _cream,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: _textMid)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, _ctrl.text.trim()),
          style: ElevatedButton.styleFrom(
            backgroundColor: _saffron,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('Save'),
        ),
      ],
    );
  }
}

// ─── Saving Dialog ────────────────────────────────────────────────────────────
class _SavingDialog extends StatelessWidget {
  const _SavingDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: const Padding(
        padding: EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(_saffron),
            ),
            SizedBox(height: 16),
            Text(
              'Saving session...',
              style: TextStyle(color: _textMid, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
String _dateKey(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
