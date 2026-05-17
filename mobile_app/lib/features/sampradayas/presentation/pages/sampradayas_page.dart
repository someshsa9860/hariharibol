import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../features/home/data/models/sampraday_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';
import '../providers/sampraday_provider.dart';

const _peacock = Color(0xFF006B6B);
const _forest = Color(0xFF2D5A27);
const _saffron = Color(0xFFFF6B00);
const _gold = Color(0xFFD4A055);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1C1209);
const _textMid = Color(0xFF7A6050);

enum _Filter { all, following }

class SampradayasPage extends ConsumerStatefulWidget {
  const SampradayasPage({super.key});

  @override
  ConsumerState<SampradayasPage> createState() => _SampradayasPageState();
}

class _SampradayasPageState extends ConsumerState<SampradayasPage> {
  _Filter _filter = _Filter.all;
  bool _initialised = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _initFollowSet());
  }

  Future<void> _initFollowSet() async {
    if (_initialised) return;
    try {
      final followed =
          await ref.read(followedSampradayListProvider.future);
      final ids = followed.map((s) => s.id).toList();
      ref
          .read(sampradayaFollowSetProvider.notifier)
          .initialise(ids);
      _initialised = true;
    } catch (_) {}
  }

  Future<void> _refresh() async {
    _initialised = false;
    ref.invalidate(sampradayListProvider);
    ref.invalidate(followedSampradayListProvider);
    await Future.wait([
      ref.read(sampradayListProvider.future),
      ref.read(followedSampradayListProvider.future),
    ]);
    await _initFollowSet();
  }

  @override
  Widget build(BuildContext context) {
    final allAsync = ref.watch(sampradayListProvider);
    final followedAsync = ref.watch(followedSampradayListProvider);
    final followedIds = ref.watch(sampradayaFollowSetProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: RefreshIndicator(
        color: _saffron,
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            _buildHero(context),
            SliverToBoxAdapter(
              child: _FilterControl(
                selected: _filter,
                onSelect: (f) => setState(() => _filter = f),
              ),
            ),
            _buildList(allAsync, followedAsync, followedIds),
          ],
        ),
      ),
    );
  }

  SliverAppBar _buildHero(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      backgroundColor: _peacock,
      leading: context.canPop()
          ? Padding(
              padding: const EdgeInsets.all(8),
              child: CircleAvatar(
                backgroundColor: Colors.black26,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded,
                      color: Colors.white, size: 20),
                  onPressed: () => context.pop(),
                ),
              ),
            )
          : null,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_peacock, _forest],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Text('🕉️', style: TextStyle(fontSize: 32)),
                  const SizedBox(height: 8),
                  Text(
                    'Spiritual Traditions',
                    style: GoogleFonts.playfairDisplay(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Explore and follow sacred lineages',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildList(
    AsyncValue<List<SampradayModel>> allAsync,
    AsyncValue<List<SampradayModel>> followedAsync,
    Set<String> followedIds,
  ) {
    final async =
        _filter == _Filter.following ? followedAsync : allAsync;
    return async.when(
      loading: _shimmerSliver,
      error: (_, __) => SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: Colors.red, size: 48),
              const SizedBox(height: 12),
              const Text('Failed to load traditions',
                  style: TextStyle(color: Colors.red)),
              TextButton(
                onPressed: _refresh,
                child: const Text('Retry',
                    style: TextStyle(color: _saffron)),
              ),
            ],
          ),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return SliverFillRemaining(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('🙏',
                      style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 16),
                  Text(
                    _filter == _Filter.following
                        ? "You haven't followed any traditions yet"
                        : 'No traditions found',
                    style: const TextStyle(
                        color: _textMid, fontSize: 15),
                  ),
                ],
              ),
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (_, i) => _SampradayCard(
                sampraday: list[i],
                isFollowing: followedIds.contains(list[i].id),
                onTap: () =>
                    context.push('/sampradayas/${list[i].id}'),
                onFollowToggle: () => ref
                    .read(sampradayaFollowSetProvider.notifier)
                    .toggle(list[i].id),
              ),
              childCount: list.length,
            ),
          ),
        );
      },
    );
  }

  Widget _shimmerSliver() {
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (_, __) => Shimmer.fromColors(
            baseColor: Colors.grey[200]!,
            highlightColor: Colors.grey[50]!,
            child: Container(
              height: 200,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
          childCount: 4,
        ),
      ),
    );
  }
}

// ─── Filter Control ───────────────────────────────────────────────────────────
class _FilterControl extends StatelessWidget {
  final _Filter selected;
  final void Function(_Filter) onSelect;
  const _FilterControl(
      {required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _peacock.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _Chip(
            label: 'All Traditions',
            isSelected: selected == _Filter.all,
            onTap: () => onSelect(_Filter.all),
          ),
          _Chip(
            label: 'Following',
            isSelected: selected == _Filter.following,
            onTap: () => onSelect(_Filter.following),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  const _Chip(
      {required this.label,
      required this.isSelected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? _peacock : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? Colors.white : _peacock,
              fontWeight: isSelected
                  ? FontWeight.bold
                  : FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Sampraday Card ───────────────────────────────────────────────────────────
class _SampradayCard extends StatelessWidget {
  final SampradayModel sampraday;
  final bool isFollowing;
  final VoidCallback onTap;
  final VoidCallback onFollowToggle;

  const _SampradayCard({
    required this.sampraday,
    required this.isFollowing,
    required this.onTap,
    required this.onFollowToggle,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 200,
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            fit: StackFit.expand,
            children: [
              sampraday.thumbnailUrl != null
                  ? CachedNetworkImage(
                      imageUrl: sampraday.thumbnailUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => _placeholder(),
                      errorWidget: (_, __, ___) => _placeholder(),
                    )
                  : _placeholder(),
              // Dark gradient overlay
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.05),
                      Colors.black.withOpacity(0.75),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Follower count badge (top-right)
                    Align(
                      alignment: Alignment.topRight,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: _gold.withOpacity(0.9),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.group_rounded,
                                color: Colors.white, size: 13),
                            const SizedBox(width: 4),
                            Text(
                              '${sampraday.followerCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Name + follow button (bottom)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text(
                            sampraday.name,
                            style: GoogleFonts.playfairDisplay(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: onFollowToggle,
                          child: AnimatedContainer(
                            duration:
                                const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: isFollowing
                                  ? Colors.white.withOpacity(0.2)
                                  : _saffron,
                              borderRadius:
                                  BorderRadius.circular(20),
                              border: isFollowing
                                  ? Border.all(
                                      color: Colors.white,
                                      width: 1.5)
                                  : null,
                            ),
                            child: Text(
                              isFollowing
                                  ? 'Following'
                                  : 'Follow',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ],
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

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [_peacock, _forest],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
      );
}
