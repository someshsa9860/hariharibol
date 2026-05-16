import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../features/auth/presentation/providers/auth_provider.dart'
    as auth;
import '../../../../features/home/data/models/sampraday_model.dart';
import '../../../../features/home/data/models/verse_model.dart';
import '../../../../features/home/data/models/verse_detail_model.dart';
import '../../../../features/reading/data/reading_progress_service.dart';
import '../providers/home_provider.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF6B00);
const _saffronDeep = Color(0xFFD96100);
const _maroon = Color(0xFF7B1C1C);
const _peacock = Color(0xFF006B6B);
const _sandstone = Color(0xFFC4A882);
const _gold = Color(0xFFD4A055);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1C1209);
const _textMid = Color(0xFF7A6050);

const _categories = ['Devotion', 'Knowledge', 'Surrender', 'Dharma', 'Stories'];

// ─── Page ─────────────────────────────────────────────────────────────────────
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  String _selectedCategory = _categories.first;

  Future<void> _refresh() async {
    ref.invalidate(verseOfDayProvider);
    ref.invalidate(sampradayListProvider);
    ref.invalidate(followedSampradayListProvider);
    ref.invalidate(randomVerseProvider);
    ref.invalidate(versesByCategoryProvider(_selectedCategory));
    ref.invalidate(todayWisdomProvider);
    await Future.wait([
      ref.read(verseOfDayProvider.future),
      ref.read(sampradayListProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(auth.authStateProvider);
    final userName = authState.maybeWhen(
      data: (s) => s.user?.name?.split(' ').first,
      orElse: () => null,
    );

    return Scaffold(
      backgroundColor: _cream,
      body: RefreshIndicator(
        color: _saffron,
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            _buildAppBar(context, userName),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _GreetingSection(userName: userName),
                  _QuickActionsRow(),
                  _ContinueReadingSection(),
                  _VerseOfDaySection(onTap: _navigateToVerse),
                  const SizedBox(height: 8),
                  _FollowedSampradaySection(onTap: _navigateToSampraday),
                  _CategorySection(
                    selected: _selectedCategory,
                    onSelect: (cat) => setState(() => _selectedCategory = cat),
                  ),
                  _VersesByCategorySection(
                    category: _selectedCategory,
                    onTap: _navigateToVerse,
                  ),
                  _RandomVerseSection(onTap: _navigateToVerse),
                  _TodayWisdomSection(),
                  _AllSampradaySection(onTap: _navigateToSampraday),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  SliverAppBar _buildAppBar(BuildContext context, String? userName) {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      floating: true,
      snap: true,
      title: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [_saffron, _saffronDeep]),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text('🕉️', style: TextStyle(fontSize: 16)),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            'HariHariBol',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: _textDark,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.search_rounded, color: _textDark),
          onPressed: () {},
        ),
        IconButton(
          icon: const Icon(Icons.notifications_none_rounded, color: _textDark),
          onPressed: () {},
        ),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: GestureDetector(
            onTap: () => context.push('/profile'),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: _saffron.withOpacity(0.15),
              child: const Icon(Icons.person_rounded, size: 18, color: _saffron),
            ),
          ),
        ),
      ],
    );
  }

  void _navigateToVerse(String verseId) => context.push('/verse/$verseId');
  void _navigateToSampraday(String id) => context.push('/sampraday/$id');
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
class _GreetingSection extends StatelessWidget {
  final String? userName;
  const _GreetingSection({this.userName});

  @override
  Widget build(BuildContext context) {
    final greeting = userName != null
        ? 'Hare Krishna, $userName 🙏'
        : 'Hare Krishna, Devotee 🙏';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            greeting,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: _saffron,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your daily dose of spiritual wisdom',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: _textMid),
          ),
        ],
      ),
    );
  }
}

// ─── Quick Actions Row ────────────────────────────────────────────────────────
class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _QuickAction(
            icon: Icons.self_improvement_rounded,
            label: 'Chant',
            color: _saffron,
            onTap: () => context.push('/chanting'),
          ),
          _QuickAction(
            icon: Icons.menu_book_rounded,
            label: 'Read',
            color: _maroon,
            onTap: () => context.push('/read'),
          ),
          _QuickAction(
            icon: Icons.spa_rounded,
            label: 'Meditate',
            color: _peacock,
            onTap: () => context.push('/gurudev'),
          ),
          _QuickAction(
            icon: Icons.favorite_rounded,
            label: 'Favorites',
            color: _gold,
            onTap: () => context.push('/profile'),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              color: _textDark,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Continue Reading ─────────────────────────────────────────────────────────
class _ContinueReadingSection extends ConsumerWidget {
  const _ContinueReadingSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(readingProgressProvider);
    if (progress == null) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () => context.push(
          '/book/${progress.bookId}/chapter/${progress.chapterNum}'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: _maroon.withOpacity(0.08),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
          border: Border.all(color: _maroon.withOpacity(0.12)),
        ),
        child: Row(
          children: [
            // Book cover thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: progress.coverUrl != null
                  ? CachedNetworkImage(
                      imageUrl: progress.coverUrl!,
                      width: 52,
                      height: 68,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _coverPlaceholder(),
                    )
                  : _coverPlaceholder(),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _maroon.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          '📖 Continue Reading',
                          style: TextStyle(
                            color: _maroon,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    progress.bookTitle,
                    style: const TextStyle(
                      color: _textDark,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    progress.chapterTitle.isNotEmpty
                        ? 'Chapter ${progress.chapterNum}: ${progress.chapterTitle}'
                        : 'Chapter ${progress.chapterNum}',
                    style: const TextStyle(
                        color: _textMid, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: _maroon.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_forward_rounded,
                  color: _maroon, size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _coverPlaceholder() => Container(
        width: 52,
        height: 68,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF7B1C1C), Color(0xFFC75A1A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(child: Text('📜', style: TextStyle(fontSize: 22))),
      );
}

// ─── Verse of Day ─────────────────────────────────────────────────────────────
class _VerseOfDaySection extends ConsumerStatefulWidget {
  final void Function(String verseId) onTap;
  const _VerseOfDaySection({required this.onTap});

  @override
  ConsumerState<_VerseOfDaySection> createState() => _VerseOfDaySectionState();
}

class _VerseOfDaySectionState extends ConsumerState<_VerseOfDaySection> {
  bool _isFav = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(verseOfDayProvider);
    return async.when(
      loading: () => const _ShimmerCard(height: 240, margin: 16),
      error: (_, __) => _ErrorCard(
        message: 'Could not load Verse of the Day',
        onRetry: () => ref.invalidate(verseOfDayProvider),
      ),
      data: (verse) => _buildCard(verse),
    );
  }

  Widget _buildCard(VerseModel verse) {
    return GestureDetector(
      onTap: () => widget.onTap(verse.id),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        decoration: BoxDecoration(
          color: _sandstone.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _sandstone.withOpacity(0.45), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: _sandstone.withOpacity(0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _saffron.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                      border:
                          Border.all(color: _saffron.withOpacity(0.3)),
                    ),
                    child: const Text(
                      '✨ Verse of the Day',
                      style: TextStyle(
                        color: _saffronDeep,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => setState(() => _isFav = !_isFav),
                    child: Icon(
                      _isFav
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      color: _isFav ? Colors.red : _textMid,
                      size: 20,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (verse.sanskrit.isNotEmpty)
                Text(
                  verse.sanskrit,
                  style: const TextStyle(
                    fontFamily: 'NotoSansDevanagari',
                    fontSize: 18,
                    color: _textDark,
                    fontWeight: FontWeight.w600,
                    height: 1.7,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              if (verse.translation != null) ...[
                const SizedBox(height: 10),
                Text(
                  verse.translation!,
                  style: const TextStyle(
                    color: _textMid,
                    fontSize: 14,
                    height: 1.5,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                      style: const TextStyle(
                        color: _textMid,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => widget.onTap(verse.id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: _saffron,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Read More',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────
class _CategorySection extends StatelessWidget {
  final String selected;
  final void Function(String) onSelect;

  const _CategorySection({required this.selected, required this.onSelect});

  static const _icons = {
    'Devotion': '🙏',
    'Knowledge': '📖',
    'Surrender': '🌸',
    'Dharma': '⚖️',
    'Stories': '✨',
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Text(
            'Categories',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: _textDark,
                ),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final cat = _categories[i];
              final isSelected = cat == selected;
              return GestureDetector(
                onTap: () => onSelect(cat),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? _saffron : Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: isSelected
                            ? _saffron.withOpacity(0.3)
                            : Colors.black.withOpacity(0.06),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_icons[cat] ?? '',
                          style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 6),
                      Text(
                        cat,
                        style: TextStyle(
                          color: isSelected ? Colors.white : _textDark,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ─── Verses by Category ───────────────────────────────────────────────────────
class _VersesByCategorySection extends ConsumerWidget {
  final String category;
  final void Function(String verseId) onTap;

  const _VersesByCategorySection(
      {required this.category, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(versesByCategoryProvider(category));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                category,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _textDark,
                    ),
              ),
              TextButton(
                onPressed: () {},
                child: const Text('View All',
                    style: TextStyle(color: _saffron, fontSize: 13)),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 160,
          child: async.when(
            loading: () => _horizontalShimmerList(),
            error: (_, __) => const Center(
              child: Text('Failed to load verses',
                  style: TextStyle(color: _textMid)),
            ),
            data: (verses) => verses.isEmpty
                ? Center(
                    child: Text(
                      'No verses in $category yet',
                      style: const TextStyle(color: _textMid),
                    ),
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: verses.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (ctx, i) =>
                        _VerseCardSmall(verse: verses[i], onTap: onTap),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _horizontalShimmerList() {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(width: 12),
      itemBuilder: (_, __) => const _ShimmerCard(width: 200, height: 160),
    );
  }
}

class _VerseCardSmall extends StatelessWidget {
  final VerseModel verse;
  final void Function(String) onTap;

  const _VerseCardSmall({required this.verse, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onTap(verse.id),
      child: Container(
        width: 200,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (verse.sanskrit.isNotEmpty)
              Text(
                verse.sanskrit,
                style: const TextStyle(
                  fontFamily: 'NotoSansDevanagari',
                  fontSize: 13,
                  color: _textDark,
                  height: 1.6,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: _saffron.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                style: const TextStyle(
                  color: _saffronDeep,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Followed Sampraday Section ───────────────────────────────────────────────
class _FollowedSampradaySection extends ConsumerWidget {
  final void Function(String id) onTap;
  const _FollowedSampradaySection({required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(followedSampradayListProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
              child: Text(
                'From Your Sampradayas',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _textDark,
                    ),
              ),
            ),
            SizedBox(
              height: 130,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) =>
                    _SampradayChip(sampraday: list[i], onTap: onTap),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SampradayChip extends StatelessWidget {
  final SampradayModel sampraday;
  final void Function(String) onTap;

  const _SampradayChip({required this.sampraday, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onTap(sampraday.id),
      child: Container(
        width: 110,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _peacock.withOpacity(0.3), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: _peacock.withOpacity(0.12),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (sampraday.thumbnailUrl != null)
                CachedNetworkImage(
                  imageUrl: sampraday.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      Container(color: _peacock.withOpacity(0.1)),
                  errorWidget: (_, __, ___) => _peacockGradient(),
                )
              else
                _peacockGradient(),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      _peacock.withOpacity(0.80),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sampraday.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${sampraday.followerCount} followers',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _peacockGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF008B8B), Color(0xFF006B6B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

// ─── Random Verse Section ─────────────────────────────────────────────────────
class _RandomVerseSection extends ConsumerWidget {
  final void Function(String verseId) onTap;
  const _RandomVerseSection({required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(randomVerseProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 20, 0, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Discover a Verse',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: _textDark,
                      ),
                ),
                GestureDetector(
                  onTap: () => ref.invalidate(randomVerseProvider),
                  child: const Row(
                    children: [
                      Icon(Icons.shuffle_rounded, size: 14, color: _maroon),
                      SizedBox(width: 4),
                      Text(
                        'Shuffle',
                        style: TextStyle(
                          color: _maroon,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          async.when(
            loading: () => const _ShimmerCard(height: 140, margin: 16),
            error: (_, __) => const SizedBox.shrink(),
            data: (verse) => GestureDetector(
              onTap: () => onTap(verse.id),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: _maroon.withOpacity(0.35), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: _maroon.withOpacity(0.10),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _maroon.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                        style: const TextStyle(
                          color: _maroon,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (verse.sanskrit.isNotEmpty)
                      Text(
                        verse.sanskrit,
                        style: const TextStyle(
                          fontFamily: 'NotoSansDevanagari',
                          fontSize: 16,
                          color: _textDark,
                          height: 1.7,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (verse.transliteration != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        verse.transliteration!,
                        style: const TextStyle(
                          fontStyle: FontStyle.italic,
                          fontSize: 12,
                          color: _textMid,
                          height: 1.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Today's Wisdom ───────────────────────────────────────────────────────────
class _TodayWisdomSection extends ConsumerWidget {
  const _TodayWisdomSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(todayWisdomProvider);
    return async.when(
      loading: () => const _ShimmerCard(height: 110, margin: 16),
      error: (_, __) => const SizedBox.shrink(),
      data: (narration) {
        if (narration == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Today's Wisdom",
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _textDark,
                    ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A4D8F),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF1A4D8F).withOpacity(0.25),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.format_quote_rounded,
                            color: _gold, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          narration.saintName,
                          style: const TextStyle(
                            color: _gold,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      narration.excerpt,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        height: 1.6,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── All Sampradays ───────────────────────────────────────────────────────────
class _AllSampradaySection extends ConsumerWidget {
  final void Function(String id) onTap;
  const _AllSampradaySection({required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(sampradayListProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Explore Traditions',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _textDark,
                    ),
              ),
              TextButton(
                onPressed: () {},
                child: const Text('View All',
                    style: TextStyle(color: _saffron, fontSize: 13)),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 180,
          child: async.when(
            loading: () => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) =>
                  const _ShimmerCard(width: 140, height: 180),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (list) => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) =>
                  _SampradayCard(sampraday: list[i], onTap: onTap),
            ),
          ),
        ),
      ],
    );
  }
}

class _SampradayCard extends StatelessWidget {
  final SampradayModel sampraday;
  final void Function(String) onTap;

  const _SampradayCard({required this.sampraday, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onTap(sampraday.id),
      child: Container(
        width: 140,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (sampraday.thumbnailUrl != null)
                CachedNetworkImage(
                  imageUrl: sampraday.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      Container(color: _gold.withOpacity(0.2)),
                  errorWidget: (_, __, ___) => _gradientPlaceholder(),
                )
              else
                _gradientPlaceholder(),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.7),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sampraday.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${sampraday.followerCount} followers',
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _gradientPlaceholder() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_gold, _saffronDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────
class _ShimmerCard extends StatelessWidget {
  final double? width;
  final double height;
  final double margin;

  const _ShimmerCard({
    this.width,
    required this.height,
    this.margin = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[200]!,
      highlightColor: Colors.grey[50]!,
      child: Container(
        width: width,
        height: height,
        margin: EdgeInsets.all(margin),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorCard({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red[200]!),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 20),
          const SizedBox(width: 8),
          Expanded(
              child: Text(message,
                  style: const TextStyle(color: Colors.red, fontSize: 13))),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry',
                style: TextStyle(color: Colors.red, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
