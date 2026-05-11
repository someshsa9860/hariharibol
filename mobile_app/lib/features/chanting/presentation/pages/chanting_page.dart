import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../providers/chanting_providers.dart';
import '../widgets/sampraday_grid_tile.dart';
import '../widgets/streak_badge.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────
class ChantingPage extends ConsumerWidget {
  const ChantingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sampradaysAsync = ref.watch(chantingSampradayListProvider);
    final followedIdsAsync = ref.watch(chantingFollowedSampradayIdsProvider);
    final lastMantra = ref.watch(lastUsedMantraProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ChantingHero(onHistoryTap: () => context.push('/chanting/history')),
                _GridHeader(onSeeAll: () {}),
              ],
            ),
          ),
          sampradaysAsync.when(
            loading: () => _buildShimmerGrid(),
            error: (_, __) => SliverToBoxAdapter(
              child: _ErrorCard(
                onRetry: () => ref.invalidate(chantingSampradayListProvider),
              ),
            ),
            data: (sampradays) {
              final followedIds = followedIdsAsync.maybeWhen(
                data: (ids) => ids,
                orElse: () => <String>{},
              );
              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                sliver: SliverGrid(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => SampradayGridTile(
                      sampraday: sampradays[i],
                      isFollowing: followedIds.contains(sampradays[i].id),
                      onTap: () =>
                          ctx.push('/sampraday/${sampradays[i].id}'),
                    ),
                    childCount: sampradays.length,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    childAspectRatio: 0.9,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: _krishnaBlue,
        onPressed: lastMantra != null
            ? () => context.push(
                  '/chant/${lastMantra.id}',
                  extra: {
                    'mantraName': lastMantra.name,
                    'goal': 108,
                  },
                )
            : () => context.push('/chanting/history'),
        icon: const Text('📿', style: TextStyle(fontSize: 18)),
        label: Text(
          lastMantra != null ? 'Continue Chanting' : 'Chant History',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
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
            'Chanting',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: _textDark,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.history_rounded, color: _textDark),
          onPressed: () => context.push('/chanting/history'),
          tooltip: 'Chant History',
        ),
      ],
    );
  }

  Widget _buildShimmerGrid() {
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      sliver: SliverGrid(
        delegate: SliverChildBuilderDelegate(
          (_, __) => Shimmer.fromColors(
            baseColor: Colors.grey[200]!,
            highlightColor: Colors.grey[50]!,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
            ),
          ),
          childCount: 6,
        ),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          childAspectRatio: 0.9,
        ),
      ),
    );
  }
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
class _ChantingHero extends ConsumerWidget {
  final VoidCallback onHistoryTap;

  const _ChantingHero({required this.onHistoryTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(chantingStatsProvider);
    final streakAsync = ref.watch(chantingStreakProvider);

    final today = statsAsync.maybeWhen(
      data: (s) {
        final key = _todayKey();
        return s.dailyStats[key] ?? 0;
      },
      orElse: () => 0,
    );
    const goal = 1080;
    final streak = streakAsync.maybeWhen(
      data: (s) => s.currentStreak,
      orElse: () => 0,
    );

    return GestureDetector(
      onTap: onHistoryTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [_krishnaBlue, Color(0xFF0D3566)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: _krishnaBlue.withOpacity(0.4),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            // Circular progress
            _CircularChantProgress(current: today, goal: goal),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Today's Chants",
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: '$today',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextSpan(
                          text: ' / $goal',
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  StreakBadge(streak: streak),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.history_rounded,
                            color: Colors.white70, size: 13),
                        SizedBox(width: 4),
                        Text(
                          'View history',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _todayKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

// ─── Circular Progress ────────────────────────────────────────────────────────
class _CircularChantProgress extends StatelessWidget {
  final int current;
  final int goal;

  const _CircularChantProgress({required this.current, required this.goal});

  @override
  Widget build(BuildContext context) {
    final progress = goal > 0 ? (current / goal).clamp(0.0, 1.0) : 0.0;

    return SizedBox(
      width: 90,
      height: 90,
      child: CustomPaint(
        painter: _RingPainter(progress: progress),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('📿', style: TextStyle(fontSize: 22)),
              Text(
                '${(progress * 100).round()}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  const _RingPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - 6;
    const strokeWidth = 7.0;

    // Track
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white.withOpacity(0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );

    // Progress arc
    if (progress > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -pi / 2,
        2 * pi * progress,
        false,
        Paint()
          ..color = _saffron
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress;
}

// ─── Grid Header ──────────────────────────────────────────────────────────────
class _GridHeader extends StatelessWidget {
  final VoidCallback onSeeAll;
  const _GridHeader({required this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 4, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Spiritual Traditions',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: _textDark,
                ),
          ),
          TextButton(
            onPressed: onSeeAll,
            child: const Text(
              'See All',
              style: TextStyle(color: _saffron, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Error Card ───────────────────────────────────────────────────────────────
class _ErrorCard extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorCard({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 40),
          const SizedBox(height: 8),
          const Text('Could not load traditions',
              style: TextStyle(color: _textMid)),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry', style: TextStyle(color: _saffron)),
          ),
        ],
      ),
    );
  }
}
