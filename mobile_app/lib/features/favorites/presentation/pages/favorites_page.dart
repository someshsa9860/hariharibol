import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../features/chanting/data/models/mantra_model.dart';
import '../../../../features/home/data/models/verse_detail_model.dart';
import '../../../../features/home/data/models/verse_model.dart';
import '../providers/favorites_providers.dart';

class FavoritesPage extends ConsumerStatefulWidget {
  const FavoritesPage({super.key});

  @override
  ConsumerState<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends ConsumerState<FavoritesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.maroon,
        foregroundColor: Colors.white,
        title: const Text(
          'My Favorites',
          style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontFamily: 'Playfair Display'),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.gold,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(
              fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Verses'),
            Tab(text: 'Mantras'),
            Tab(text: 'Narrations'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _VersesTab(
            onVerseRemoved: () => ref.invalidate(favoriteVersesProvider),
          ),
          _MantrasTab(
            onMantraRemoved: () => ref.invalidate(favoriteMantrasProvider),
          ),
          const _NarrationsTab(),
        ],
      ),
    );
  }
}

// ─── Verses Tab ───────────────────────────────────────────────────────────────

class _VersesTab extends ConsumerWidget {
  final VoidCallback onVerseRemoved;
  const _VersesTab({required this.onVerseRemoved});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versesAsync = ref.watch(favoriteVersesProvider);
    return versesAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.saffron)),
      error: (_, __) => const _ListError(),
      data: (verses) {
        if (verses.isEmpty) {
          return const _EmptyTab(
            icon: Icons.favorite_border_rounded,
            message: 'No favorite verses yet',
            hint: 'Tap the heart on any verse to save it here',
          );
        }
        return RefreshIndicator(
          color: AppColors.saffron,
          onRefresh: () async => ref.invalidate(favoriteVersesProvider),
          child: ListView.separated(
            padding:
                const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            itemCount: verses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _VerseCard(
              verse: verses[i],
              onTap: () => context.push('/verse/${verses[i].id}'),
              onRemove: () async {
                try {
                  await removeVerseFavorite(ref, verses[i].id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Removed from favorites')),
                    );
                  }
                } catch (_) {}
              },
            ),
          ),
        );
      },
    );
  }
}

class _VerseCard extends StatelessWidget {
  final VerseModel verse;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const _VerseCard({
    required this.verse,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.sandstone.withOpacity(0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: AppColors.sandstone.withOpacity(0.35)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    verse.sanskrit.isNotEmpty ? verse.sanskrit : 'Verse',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textDark,
                      fontStyle: FontStyle.italic,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.peacock.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.peacock,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.favorite_rounded,
                  color: AppColors.saffron, size: 20),
              onPressed: onRemove,
              tooltip: 'Remove from favorites',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Mantras Tab ──────────────────────────────────────────────────────────────

class _MantrasTab extends ConsumerWidget {
  final VoidCallback onMantraRemoved;
  const _MantrasTab({required this.onMantraRemoved});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mantrasAsync = ref.watch(favoriteMantrasProvider);
    return mantrasAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.saffron)),
      error: (_, __) => const _ListError(),
      data: (mantras) {
        if (mantras.isEmpty) {
          return const _EmptyTab(
            icon: Icons.self_improvement_rounded,
            message: 'No favorite mantras yet',
            hint: 'Save mantras to access them quickly',
          );
        }
        return RefreshIndicator(
          color: AppColors.saffron,
          onRefresh: () async => ref.invalidate(favoriteMantrasProvider),
          child: ListView.separated(
            padding:
                const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            itemCount: mantras.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _MantraCard(
              mantra: mantras[i],
              onTap: () => context.push('/mantra/${mantras[i].id}'),
              onRemove: () async {
                try {
                  await removeMantraFavorite(ref, mantras[i].id);
                } catch (_) {}
              },
            ),
          ),
        );
      },
    );
  }
}

class _MantraCard extends StatelessWidget {
  final MantraModel mantra;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const _MantraCard({
    required this.mantra,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.maroon.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text(
                  'ॐ',
                  style: TextStyle(
                      color: AppColors.maroon,
                      fontSize: 20,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    mantra.name,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textDark),
                  ),
                  if (mantra.category != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      mantra.category!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.play_circle_rounded,
                  color: AppColors.saffron, size: 28),
              onPressed: onTap,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.favorite_rounded,
                  color: AppColors.saffron, size: 20),
              onPressed: onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Narrations Tab ───────────────────────────────────────────────────────────

class _NarrationsTab extends ConsumerWidget {
  const _NarrationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final narrAsync = ref.watch(favoriteNarrationsProvider);
    return narrAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.saffron)),
      error: (_, __) => const _ListError(),
      data: (narrations) {
        if (narrations.isEmpty) {
          return const _EmptyTab(
            icon: Icons.headphones_rounded,
            message: 'No favorite narrations yet',
            hint: 'Save spiritual stories to listen later',
          );
        }
        return ListView.separated(
          padding:
              const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          itemCount: narrations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _NarrationCard(narration: narrations[i]),
        );
      },
    );
  }
}

class _NarrationCard extends StatelessWidget {
  final NarrationModel narration;
  const _NarrationCard({required this.narration});

  @override
  Widget build(BuildContext context) {
    return Container(
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
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.peacock.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.headphones_rounded,
                color: AppColors.peacock, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  narration.excerpt,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textDark,
                      height: 1.4),
                ),
                const SizedBox(height: 4),
                Text(
                  narration.saintName,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (narration.audioUrl != null)
            const Icon(Icons.play_circle_outline_rounded,
                color: AppColors.saffron, size: 26),
        ],
      ),
    );
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

class _EmptyTab extends StatelessWidget {
  final IconData icon;
  final String message;
  final String hint;

  const _EmptyTab({
    required this.icon,
    required this.message,
    required this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 64,
                color: AppColors.textMuted.withOpacity(0.4)),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              hint,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _ListError extends StatelessWidget {
  const _ListError();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 40, color: AppColors.error),
          SizedBox(height: 8),
          Text('Failed to load',
              style: TextStyle(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}
