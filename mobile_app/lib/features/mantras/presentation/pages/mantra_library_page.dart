import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../features/chanting/data/models/mantra_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';
import '../providers/mantra_providers.dart';

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

const _categories = [
  'all',
  'morning',
  'evening',
  'devotional',
  'meditation',
];

const _categoryLabels = {
  'all': 'All',
  'morning': 'Morning',
  'evening': 'Evening',
  'devotional': 'Devotional',
  'meditation': 'Meditation',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
class MantraLibraryPage extends ConsumerStatefulWidget {
  const MantraLibraryPage({super.key});

  @override
  ConsumerState<MantraLibraryPage> createState() => _MantraLibraryPageState();
}

class _MantraLibraryPageState extends ConsumerState<MantraLibraryPage> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filteredAsync = ref.watch(filteredMantrasProvider);
    final selectedCategory = ref.watch(mantraSelectedCategoryProvider);
    final audioState = ref.watch(mantraAudioProvider);

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
          'Mantra Library',
          style: TextStyle(
            color: _textDark,
            fontWeight: FontWeight.bold,
            fontSize: 18,
            fontFamily: 'Georgia',
          ),
        ),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // Search bar
              _SearchBar(
                controller: _searchCtrl,
                onChanged: (q) =>
                    ref.read(mantraSearchProvider.notifier).state = q,
              ),
              // Category filter chips
              _CategoryChips(
                selected: selectedCategory,
                onSelect: (cat) =>
                    ref
                        .read(mantraSelectedCategoryProvider.notifier)
                        .state = cat,
              ),
              // Mantra list
              Expanded(
                child: filteredAsync.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(
                      color: _saffron,
                      strokeWidth: 2,
                    ),
                  ),
                  error: (e, _) => _ErrorView(
                    onRetry: () => ref.invalidate(mantrasListProvider),
                  ),
                  data: (mantras) => mantras.isEmpty
                      ? const _EmptyView()
                      : ListView.builder(
                          padding: EdgeInsets.only(
                            top: 4,
                            bottom: audioState.hasTrack ? 120 : 24,
                          ),
                          itemCount: mantras.length,
                          itemBuilder: (ctx, i) =>
                              _MantraCard(mantra: mantras[i]),
                        ),
                ),
              ),
            ],
          ),
          // Mini audio player
          if (audioState.hasTrack)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _MiniPlayer(state: audioState),
            ),
        ],
      ),
    );
  }
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _SearchBar({required this.controller, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: 'Search mantras...',
          hintStyle: const TextStyle(color: _textMid, fontSize: 14),
          prefixIcon: const Icon(Icons.search_rounded, color: _peacock, size: 22),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded,
                      color: _textMid, size: 18),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: _cream,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

// ─── Category Chips ───────────────────────────────────────────────────────────
class _CategoryChips extends StatelessWidget {
  final String? selected;
  final ValueChanged<String?> onSelect;

  const _CategoryChips({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(bottom: 12),
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final cat = _categories[i];
          final isSelected = selected == cat ||
              (cat == 'all' && (selected == null || selected == 'all'));
          return GestureDetector(
            onTap: () => onSelect(cat == 'all' ? null : cat),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? _peacock : _cream,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? _peacock
                      : _sandstone.withOpacity(0.4),
                  width: 1.2,
                ),
              ),
              child: Text(
                _categoryLabels[cat] ?? cat,
                style: TextStyle(
                  color: isSelected ? Colors.white : _textMid,
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── Mantra Card ──────────────────────────────────────────────────────────────
class _MantraCard extends ConsumerWidget {
  final MantraModel mantra;

  const _MantraCard({required this.mantra});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final audioState = ref.watch(mantraAudioProvider);
    final favoriteIds = ref.watch(mantraFavoriteIdsProvider);
    final isPlaying =
        audioState.mantraId == mantra.id && audioState.isPlaying;
    final isFavorite = favoriteIds.contains(mantra.id);

    return GestureDetector(
      onTap: () => context.push('/mantra/${mantra.id}'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _sandstone.withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _sandstone.withOpacity(0.35), width: 1),
        ),
        child: Row(
          children: [
            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    mantra.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: _textDark,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (mantra.sampradayName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      mantra.sampradayName!,
                      style:
                          const TextStyle(color: _textMid, fontSize: 12),
                    ),
                  ] else if (mantra.category != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      mantra.category!,
                      style:
                          const TextStyle(color: _textMid, fontSize: 12),
                    ),
                  ],
                  if (mantra.meaning != null) ...[
                    const SizedBox(height: 5),
                    Text(
                      _firstLine(mantra.meaning!),
                      style: const TextStyle(
                        color: _textMid,
                        fontSize: 12,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Right-side actions
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Recommendation badge
                if (mantra.recommendationCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 3),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: _gold.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.thumb_up_rounded,
                            color: _gold, size: 10),
                        const SizedBox(width: 3),
                        Text(
                          '${mantra.recommendationCount}',
                          style: const TextStyle(
                            color: _gold,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Play button (only if audio available)
                    if (mantra.audioUrl != null)
                      GestureDetector(
                        onTap: () => ref
                            .read(mantraAudioProvider.notifier)
                            .play(mantra.id, mantra.name, mantra.audioUrl!),
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: audioState.mantraId == mantra.id
                                ? _peacock
                                : _peacock.withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: audioState.mantraId == mantra.id
                                ? Colors.white
                                : _peacock,
                            size: 18,
                          ),
                        ),
                      ),
                    const SizedBox(width: 8),
                    // Favorite button
                    GestureDetector(
                      onTap: () =>
                          _toggleFavorite(ref, isFavorite),
                      child: Icon(
                        isFavorite
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: isFavorite ? _saffron : _textMid,
                        size: 22,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _firstLine(String text) {
    final line = text.split('.').first.trim();
    return line.length > 80 ? '${line.substring(0, 80)}...' : line;
  }

  Future<void> _toggleFavorite(WidgetRef ref, bool isFavorite) async {
    final ids = Set<String>.from(ref.read(mantraFavoriteIdsProvider));
    // Optimistic update
    if (isFavorite) {
      ids.remove(mantra.id);
    } else {
      ids.add(mantra.id);
    }
    ref.read(mantraFavoriteIdsProvider.notifier).state = ids;

    try {
      final dio = ref.read(dioProvider);
      if (isFavorite) {
        await dio.delete('/api/v1/mantras/${mantra.id}/favorite');
      } else {
        await dio.post('/api/v1/mantras/${mantra.id}/favorite');
      }
    } catch (_) {
      // Revert on failure
      final revert = Set<String>.from(ref.read(mantraFavoriteIdsProvider));
      if (isFavorite) {
        revert.add(mantra.id);
      } else {
        revert.remove(mantra.id);
      }
      ref.read(mantraFavoriteIdsProvider.notifier).state = revert;
    }
  }
}

// ─── Mini Player ──────────────────────────────────────────────────────────────
class _MiniPlayer extends ConsumerWidget {
  final MantraAudioState state;

  const _MiniPlayer({required this.state});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(mantraAudioProvider.notifier);
    final progress = state.duration.inMilliseconds > 0
        ? state.position.inMilliseconds / state.duration.inMilliseconds
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: _peacock,
        boxShadow: [
          BoxShadow(
            color: _peacock.withOpacity(0.4),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(context).padding.bottom + 12,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _WaveformBars(isPlaying: state.isPlaying),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  state.mantraName ?? '',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () =>
                    state.isPlaying ? notifier.pause() : notifier.resume(),
                child: Icon(
                  state.isPlaying
                      ? Icons.pause_rounded
                      : Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => notifier.stop(),
                child: const Icon(
                  Icons.close_rounded,
                  color: Colors.white70,
                  size: 22,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: Colors.white,
              inactiveTrackColor: Colors.white.withOpacity(0.3),
              thumbColor: Colors.white,
              thumbShape:
                  const RoundSliderThumbShape(enabledThumbRadius: 5),
              overlayShape:
                  const RoundSliderOverlayShape(overlayRadius: 10),
              trackHeight: 2,
            ),
            child: Slider(
              value: progress.clamp(0.0, 1.0),
              onChanged: (v) {
                final target = Duration(
                  milliseconds:
                      (v * state.duration.inMilliseconds).round(),
                );
                notifier.seek(target);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Waveform Bars ────────────────────────────────────────────────────────────
class _WaveformBars extends StatefulWidget {
  final bool isPlaying;

  const _WaveformBars({required this.isPlaying});

  @override
  State<_WaveformBars> createState() => _WaveformBarsState();
}

class _WaveformBarsState extends State<_WaveformBars>
    with TickerProviderStateMixin {
  late final List<AnimationController> _ctrls;
  late final List<Animation<double>> _anims;

  @override
  void initState() {
    super.initState();
    final durations = [280, 360, 240, 320];
    _ctrls = List.generate(
      4,
      (i) => AnimationController(
        vsync: this,
        duration: Duration(milliseconds: durations[i]),
      ),
    );
    _anims = _ctrls
        .map((c) => Tween<double>(begin: 3, end: 14).animate(
              CurvedAnimation(parent: c, curve: Curves.easeInOut),
            ))
        .toList();
    if (widget.isPlaying) _start();
  }

  @override
  void didUpdateWidget(_WaveformBars old) {
    super.didUpdateWidget(old);
    if (widget.isPlaying != old.isPlaying) {
      widget.isPlaying ? _start() : _stop();
    }
  }

  void _start() {
    for (var c in _ctrls) c.repeat(reverse: true);
  }

  void _stop() {
    for (var c in _ctrls) {
      c.stop();
      c.value = 0.2;
    }
  }

  @override
  void dispose() {
    for (var c in _ctrls) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 24,
      height: 16,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(
          4,
          (i) => AnimatedBuilder(
            animation: _anims[i],
            builder: (_, __) => Container(
              width: 3,
              height: _anims[i].value,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Error + Empty states ─────────────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _textMid, size: 48),
          const SizedBox(height: 12),
          const Text('Could not load mantras',
              style: TextStyle(color: _textMid)),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry', style: TextStyle(color: _saffron)),
          ),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('🔍', style: TextStyle(fontSize: 48)),
          SizedBox(height: 12),
          Text(
            'No mantras found',
            style: TextStyle(color: _textMid, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
