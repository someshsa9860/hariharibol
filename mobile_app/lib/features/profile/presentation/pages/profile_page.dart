import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../home/data/models/sampraday_model.dart';
import '../../../home/data/models/verse_model.dart';
import '../providers/profile_providers.dart';
import 'edit_profile_sheet.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final sampradayasAsync = ref.watch(profileFollowedSampradayasProvider);
    final versesAsync = ref.watch(profileFavoriteVersesProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: profileAsync.when(
        loading: () => const _ProfileShimmer(),
        error: (_, __) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 8),
              const Text('Failed to load profile'),
              TextButton(
                onPressed: () => ref.invalidate(profileProvider),
                child: const Text('Retry',
                    style: TextStyle(color: AppColors.saffron)),
              ),
            ],
          ),
        ),
        data: (profile) => CustomScrollView(
          slivers: [
            _ProfileAppBar(
              profile: profile,
              onEditTap: () => _showEditSheet(context, ref, profile),
            ),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StatsRow(profile: profile),
                  _FollowedSampradayasSection(
                    sampradayasAsync: sampradayasAsync,
                    onTap: (id) => context.push('/sampraday/$id'),
                  ),
                  _FavoriteVersesSection(
                    versesAsync: versesAsync,
                    onTap: (id) => context.push('/verse/$id'),
                  ),
                  _SignOutButton(),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showEditSheet(
      BuildContext context, WidgetRef ref, ProfileData profile) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EditProfileSheet(
        currentName: profile.name,
        onSaved: () {
          ref.invalidate(profileProvider);
        },
      ),
    );
  }
}

// ─── Profile AppBar ───────────────────────────────────────────────────────────

class _ProfileAppBar extends StatelessWidget {
  final ProfileData profile;
  final VoidCallback onEditTap;
  const _ProfileAppBar({required this.profile, required this.onEditTap});

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 316,
      pinned: true,
      backgroundColor: AppColors.maroon,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
        onPressed: () => context.pop(),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.settings_rounded, color: Colors.white),
          onPressed: () => context.push('/settings'),
          tooltip: 'Settings',
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.maroon, AppColors.saffron],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 24),
                // Avatar — 100px inner with 4px gold border = 108px total
                Container(
                  width: 108,
                  height: 108,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.gold, width: 4),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.25),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: profile.avatarUrl != null
                        ? CachedNetworkImage(
                            imageUrl: profile.avatarUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) =>
                                Container(color: AppColors.gold.withOpacity(0.3)),
                            errorWidget: (_, __, ___) =>
                                _DefaultAvatar(name: profile.name),
                          )
                        : _DefaultAvatar(name: profile.name),
                  ),
                ),
                const SizedBox(height: 12),
                // Name — Playfair Display
                Text(
                  profile.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Playfair Display',
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
                  const SizedBox(height: 4),
                  Text(
                    'Devotee since ${_joinDate(profile.joinedAt!)}',
                    style: const TextStyle(
                        color: Colors.white60, fontSize: 11),
                  ),
                ],
                const SizedBox(height: 14),
                // Edit profile button
                OutlinedButton.icon(
                  onPressed: onEditTap,
                  icon: const Icon(Icons.edit_outlined,
                      size: 15, color: Colors.white),
                  label: const Text(
                    'Edit Profile',
                    style: TextStyle(color: Colors.white, fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white70),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 7),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20)),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _joinDate(DateTime dt) {
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${m[dt.month - 1]} ${dt.year}';
  }
}

class _DefaultAvatar extends StatelessWidget {
  final String name;
  const _DefaultAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.gold.withOpacity(0.3),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
              color: Colors.white,
              fontSize: 38,
              fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final ProfileData profile;
  const _StatsRow({required this.profile});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Row(
        children: [
          _StatCard(
              label: 'Verses\nFavorited',
              value: profile.favoritesCount),
          const SizedBox(width: 10),
          _StatCard(
              label: 'Mantras\nChanted',
              value: profile.totalChants),
          const SizedBox(width: 10),
          _StatCard(
              label: 'Chanting\nStreak',
              value: profile.currentStreak,
              suffix: 'd'),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final String? suffix;
  const _StatCard(
      {required this.label, required this.value, this.suffix});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.sandstone.withOpacity(0.18),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: AppColors.sandstone.withOpacity(0.40)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            RichText(
              text: TextSpan(
                text: value.toString(),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.gold,
                ),
                children: suffix != null
                    ? [
                        TextSpan(
                          text: suffix,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500),
                        )
                      ]
                    : [],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                  height: 1.3),
            ),
          ],
        ),
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
              padding:
                  const EdgeInsets.fromLTRB(16, 22, 16, 10),
              child: Text(
                'Your Traditions',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textDark),
              ),
            ),
            SizedBox(
              height: 46,
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
                      color: AppColors.peacock.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                          color:
                              AppColors.peacock.withOpacity(0.30)),
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
                            color: AppColors.peacock,
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
        final shown = verses.take(3).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding:
                  const EdgeInsets.fromLTRB(16, 22, 16, 10),
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
                            color: AppColors.textDark),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('See All',
                        style: TextStyle(
                            color: AppColors.saffron,
                            fontSize: 13)),
                  ),
                ],
              ),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16),
              itemCount: shown.length,
              itemBuilder: (_, i) => _VerseListTile(
                verse: shown[i],
                onTap: () => onTap(shown[i].id),
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
  const _VerseListTile({required this.verse, required this.onTap});

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
                color: AppColors.saffron.withOpacity(0.10),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.favorite_rounded,
                    color: AppColors.saffron, size: 18),
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
                        color: AppColors.textDark,
                        height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${verse.bookTitle} '
                    '${verse.chapterNumber}:${verse.verseNumber}',
                    style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

// ─── Sign Out Button ──────────────────────────────────────────────────────────

class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
      child: OutlinedButton.icon(
        icon: const Icon(Icons.logout_rounded, color: AppColors.maroon),
        label: const Text(
          'Sign Out',
          style: TextStyle(
              color: AppColors.maroon, fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppColors.maroon),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24)),
          minimumSize: const Size(double.infinity, 0),
        ),
        onPressed: () => _confirm(context, ref),
      ),
    );
  }

  Future<void> _confirm(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign Out',
                style: TextStyle(color: AppColors.maroon)),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await ref.read(authStateProvider.notifier).logout();
      if (context.mounted) context.go('/login');
    }
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
          Container(height: 316, color: Colors.white),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: List.generate(
                3,
                (_) => Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 5),
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            margin:
                const EdgeInsets.symmetric(horizontal: 16),
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
