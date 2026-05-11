import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../home/data/models/sampraday_model.dart';
import '../../../home/data/models/verse_model.dart';
import '../providers/profile_providers.dart';

const _saffron = Color(0xFFFF7E00);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final sampradayasAsync =
        ref.watch(profileFollowedSampradayasProvider);
    final versesAsync = ref.watch(profileFavoriteVersesProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: profileAsync.when(
        loading: () => const _ProfileShimmer(),
        error: (_, __) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  size: 48, color: Colors.red),
              const SizedBox(height: 8),
              const Text('Failed to load profile'),
              TextButton(
                onPressed: () => ref.invalidate(profileProvider),
                child: const Text('Retry',
                    style: TextStyle(color: _saffron)),
              ),
            ],
          ),
        ),
        data: (profile) => CustomScrollView(
          slivers: [
            _ProfileAppBar(profile: profile),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StatsGrid(profile: profile),
                  _FollowedSampradayasSection(
                    sampradayasAsync: sampradayasAsync,
                    onTap: (id) => context.push('/sampraday/$id'),
                  ),
                  _FavoriteVersesSection(
                    versesAsync: versesAsync,
                    onTap: (id) => context.push('/verse/$id'),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Profile AppBar ───────────────────────────────────────────────────────────
class _ProfileAppBar extends StatelessWidget {
  final ProfileData profile;
  const _ProfileAppBar({required this.profile});

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 240,
      pinned: true,
      backgroundColor: _krishnaBlue,
      leading: IconButton(
        icon:
            const Icon(Icons.arrow_back_rounded, color: Colors.white),
        onPressed: () => context.pop(),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.settings_rounded,
              color: Colors.white),
          onPressed: () => context.push('/settings'),
          tooltip: 'Settings',
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_krishnaBlue, Color(0xFF0D3566)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 16),
                // Avatar
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: _gold, width: 3),
                      ),
                      child: ClipOval(
                        child: profile.avatarUrl != null
                            ? CachedNetworkImage(
                                imageUrl: profile.avatarUrl!,
                                fit: BoxFit.cover,
                                placeholder: (_, __) =>
                                    Container(color: _gold.withOpacity(0.3)),
                                errorWidget: (_, __, ___) =>
                                    _DefaultAvatar(name: profile.name),
                              )
                            : _DefaultAvatar(name: profile.name),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  profile.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (profile.email != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    profile.email!,
                    style: const TextStyle(
                        color: Colors.white70, fontSize: 13),
                  ),
                ],
                if (profile.joinedAt != null) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Devotee since ${_formatJoinDate(profile.joinedAt!)}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatJoinDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[dt.month - 1]} ${dt.year}';
  }
}

class _DefaultAvatar extends StatelessWidget {
  final String name;
  const _DefaultAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _gold.withOpacity(0.3),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

// ─── Stats Grid ───────────────────────────────────────────────────────────────
class _StatsGrid extends StatelessWidget {
  final ProfileData profile;
  const _StatsGrid({required this.profile});

  @override
  Widget build(BuildContext context) {
    final stats = [
      _StatItem(
          icon: '❤️',
          label: 'Favorites',
          value: profile.favoritesCount),
      _StatItem(
          icon: '📿',
          label: 'Chants',
          value: profile.totalChants),
      _StatItem(
          icon: '🔥',
          label: 'Day Streak',
          value: profile.currentStreak),
      _StatItem(
          icon: '🕉️',
          label: 'Traditions',
          value: profile.followedSampradayasCount),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
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
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 2.2,
        ),
        itemCount: stats.length,
        itemBuilder: (_, i) => _StatCard(stat: stats[i]),
      ),
    );
  }
}

class _StatItem {
  final String icon;
  final String label;
  final int value;
  const _StatItem(
      {required this.icon,
      required this.label,
      required this.value});
}

class _StatCard extends StatelessWidget {
  final _StatItem stat;
  const _StatCard({required this.stat});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _saffron.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text(stat.icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                stat.value.toString(),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: _textDark,
                ),
              ),
              Text(
                stat.label,
                style: const TextStyle(
                    fontSize: 11, color: _textMid),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Followed Sampradayas ─────────────────────────────────────────────────────
class _FollowedSampradayasSection extends StatelessWidget {
  final AsyncValue<List<SampradayModel>> sampradayasAsync;
  final void Function(String) onTap;

  const _FollowedSampradayasSection({
    required this.sampradayasAsync,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return sampradayasAsync.when(
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
                'Your Traditions',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: _textDark,
                    ),
              ),
            ),
            SizedBox(
              height: 48,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: 8),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => onTap(list[i].id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: _krishnaBlue.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                          color: _krishnaBlue.withOpacity(0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🕉️',
                            style: TextStyle(fontSize: 14)),
                        const SizedBox(width: 6),
                        Text(
                          list[i].name,
                          style: const TextStyle(
                            fontSize: 13,
                            color: _krishnaBlue,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ─── Favorite Verses ──────────────────────────────────────────────────────────
class _FavoriteVersesSection extends StatelessWidget {
  final AsyncValue<List<VerseModel>> versesAsync;
  final void Function(String) onTap;

  const _FavoriteVersesSection({
    required this.versesAsync,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return versesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (verses) {
        if (verses.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
              child: Row(
                mainAxisAlignment:
                    MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Favorite Verses',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: _textDark,
                        ),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('See All',
                        style: TextStyle(
                            color: _saffron, fontSize: 13)),
                  ),
                ],
              ),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16),
              itemCount: verses.length,
              itemBuilder: (_, i) => _VerseListTile(
                verse: verses[i],
                onTap: () => onTap(verses[i].id),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _VerseListTile extends StatelessWidget {
  final VerseModel verse;
  final VoidCallback onTap;

  const _VerseListTile(
      {required this.verse, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _saffron.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.favorite_rounded,
                    color: _saffron, size: 18),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    verse.sanskrit.isNotEmpty
                        ? verse.sanskrit
                        : 'Verse',
                    style: const TextStyle(
                      fontSize: 13,
                      color: _textDark,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                    style: const TextStyle(
                        fontSize: 11, color: _textMid),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: _textMid),
          ],
        ),
      ),
    );
  }
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
class _ProfileShimmer extends StatelessWidget {
  const _ProfileShimmer();

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[200]!,
      highlightColor: Colors.grey[50]!,
      child: Column(
        children: [
          Container(
            height: 240,
            color: Colors.white,
          ),
          const SizedBox(height: 16),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            height: 140,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ],
      ),
    );
  }
}
