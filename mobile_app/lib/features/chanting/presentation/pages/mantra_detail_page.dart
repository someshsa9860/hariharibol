import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';

import '../../data/models/mantra_model.dart';
import '../providers/chanting_providers.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────
class MantraDetailPage extends ConsumerWidget {
  final String mantraId;

  const MantraDetailPage({super.key, required this.mantraId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mantraDetailProvider(mantraId));

    return async.when(
      loading: () => const Scaffold(
        backgroundColor: _cream,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(_saffron),
          ),
        ),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: _cream,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
            onPressed: () => context.pop(),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              const Text('Failed to load mantra',
                  style: TextStyle(color: Colors.red)),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(mantraDetailProvider(mantraId)),
                child: const Text('Retry',
                    style: TextStyle(color: _saffron)),
              ),
            ],
          ),
        ),
      ),
      data: (mantra) => _MantraDetailView(mantra: mantra),
    );
  }
}

// ─── Detail View (StatefulWidget for audio + collapsible) ─────────────────────
class _MantraDetailView extends ConsumerStatefulWidget {
  final MantraModel mantra;
  const _MantraDetailView({required this.mantra});

  @override
  ConsumerState<_MantraDetailView> createState() => _MantraDetailViewState();
}

class _MantraDetailViewState extends ConsumerState<_MantraDetailView> {
  late final AudioPlayer _player;
  bool _meaningExpanded = false;
  bool _significanceExpanded = false;
  bool _isLoopEnabled = false;
  bool _audioReady = false;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _initAudio();
  }

  Future<void> _initAudio() async {
    if (widget.mantra.audioUrl != null) {
      try {
        await _player.setUrl(widget.mantra.audioUrl!);
        if (mounted) setState(() => _audioReady = true);
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  void _startChanting() {
    ref.read(lastUsedMantraProvider.notifier).state = widget.mantra;
    context.push(
      '/chant/${widget.mantra.id}',
      extra: {
        'mantraName': widget.mantra.name,
        'goal': 108,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final mantra = widget.mantra;
    return Scaffold(
      backgroundColor: _cream,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              _buildAppBar(context),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 140),
                  child: Column(
                    children: [
                      // Sanskrit
                      if (mantra.sanskrit != null && mantra.sanskrit!.isNotEmpty)
                        _SanskritBlock(text: mantra.sanskrit!),
                      // Transliteration
                      if (mantra.transliteration != null)
                        _TransliterationBlock(text: mantra.transliteration!),
                      const SizedBox(height: 24),
                      // Audio player
                      if (mantra.audioUrl != null)
                        _AudioPlayerWidget(
                          player: _player,
                          isReady: _audioReady,
                          isLooping: _isLoopEnabled,
                          onLoopToggle: () {
                            setState(() => _isLoopEnabled = !_isLoopEnabled);
                            _player.setLoopMode(
                              _isLoopEnabled ? LoopMode.one : LoopMode.off,
                            );
                          },
                        ),
                      const SizedBox(height: 16),
                      // Meaning collapsible
                      if (mantra.meaning != null)
                        _CollapsibleSection(
                          title: 'Meaning',
                          content: mantra.meaning!,
                          isExpanded: _meaningExpanded,
                          onToggle: () =>
                              setState(() => _meaningExpanded = !_meaningExpanded),
                        ),
                      const SizedBox(height: 10),
                      // Significance collapsible
                      if (mantra.significance != null)
                        _CollapsibleSection(
                          title: 'Significance',
                          content: mantra.significance!,
                          isExpanded: _significanceExpanded,
                          onToggle: () => setState(
                            () => _significanceExpanded = !_significanceExpanded,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          // Sticky bottom button
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StartChantingBar(onTap: _startChanting),
          ),
        ],
      ),
    );
  }

  SliverAppBar _buildAppBar(BuildContext context) {
    return SliverAppBar(
      backgroundColor: _cream,
      elevation: 0,
      floating: false,
      pinned: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
        onPressed: () => context.pop(),
      ),
      title: Text(
        widget.mantra.name,
        style: const TextStyle(
          color: _textDark,
          fontWeight: FontWeight.bold,
          fontSize: 16,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.share_rounded, color: _textMid),
          onPressed: () {},
        ),
      ],
    );
  }
}

// ─── Sanskrit Block ───────────────────────────────────────────────────────────
class _SanskritBlock extends StatelessWidget {
  final String text;
  const _SanskritBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 12),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontFamily: 'NotoSansDevanagari',
          fontSize: 28,
          color: _textDark,
          height: 1.8,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─── Transliteration Block ────────────────────────────────────────────────────
class _TransliterationBlock extends StatelessWidget {
  final String text;
  const _TransliterationBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 18,
          fontStyle: FontStyle.italic,
          color: _textMid,
          height: 1.6,
        ),
      ),
    );
  }
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
class _AudioPlayerWidget extends StatelessWidget {
  final AudioPlayer player;
  final bool isReady;
  final bool isLooping;
  final VoidCallback onLoopToggle;

  const _AudioPlayerWidget({
    required this.player,
    required this.isReady,
    required this.isLooping,
    required this.onLoopToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.music_note_rounded, color: _saffron, size: 18),
              const SizedBox(width: 8),
              const Text(
                'Audio Recitation',
                style: TextStyle(
                  color: _textDark,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              const Spacer(),
              // Loop toggle
              GestureDetector(
                onTap: onLoopToggle,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: isLooping
                        ? _saffron.withOpacity(0.15)
                        : Colors.grey[100],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.repeat_rounded,
                          color: isLooping ? _saffron : _textMid, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        'Loop',
                        style: TextStyle(
                          color: isLooping ? _saffron : _textMid,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Progress + controls
          if (!isReady)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: LinearProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(_saffron),
                backgroundColor: Color(0xFFFFE0C0),
              ),
            )
          else ...[
            // Seek bar
            StreamBuilder<Duration?>(
              stream: player.durationStream,
              builder: (context, durationSnap) {
                return StreamBuilder<Duration>(
                  stream: player.positionStream,
                  builder: (context, posSnap) {
                    final duration = durationSnap.data ?? Duration.zero;
                    final pos = posSnap.data ?? Duration.zero;
                    final progress = duration.inMilliseconds > 0
                        ? pos.inMilliseconds / duration.inMilliseconds
                        : 0.0;

                    return Column(
                      children: [
                        SliderTheme(
                          data: SliderTheme.of(context).copyWith(
                            activeTrackColor: _saffron,
                            inactiveTrackColor: _saffron.withOpacity(0.2),
                            thumbColor: _saffron,
                            thumbShape: const RoundSliderThumbShape(
                                enabledThumbRadius: 7),
                            overlayShape: const RoundSliderOverlayShape(
                                overlayRadius: 14),
                            trackHeight: 3,
                          ),
                          child: Slider(
                            value: progress.clamp(0.0, 1.0),
                            onChanged: (v) {
                              final target = Duration(
                                milliseconds:
                                    (v * duration.inMilliseconds).round(),
                              );
                              player.seek(target);
                            },
                          ),
                        ),
                        Padding(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _formatDuration(pos),
                                style: const TextStyle(
                                    color: _textMid, fontSize: 11),
                              ),
                              Text(
                                _formatDuration(duration),
                                style: const TextStyle(
                                    color: _textMid, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
            const SizedBox(height: 8),
            // Play / Pause
            StreamBuilder<PlayerState>(
              stream: player.playerStateStream,
              builder: (context, snap) {
                final isPlaying = snap.data?.playing ?? false;
                return GestureDetector(
                  onTap: () =>
                      isPlaying ? player.pause() : player.play(),
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_saffron, _saffronDeep],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: _saffron.withOpacity(0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(
                      isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
class _CollapsibleSection extends StatelessWidget {
  final String title;
  final String content;
  final bool isExpanded;
  final VoidCallback onToggle;

  const _CollapsibleSection({
    required this.title,
    required this.content,
    required this.isExpanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: onToggle,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _gold.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        title == 'Meaning' ? '📖' : '✨',
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    title,
                    style: const TextStyle(
                      color: _textDark,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const Spacer(),
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down_rounded,
                        color: _textMid),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(height: 0),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                content,
                style: const TextStyle(
                  color: _textDark,
                  fontSize: 14,
                  height: 1.7,
                ),
              ),
            ),
            crossFadeState: isExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 220),
          ),
        ],
      ),
    );
  }
}

// ─── Start Chanting Bar ───────────────────────────────────────────────────────
class _StartChantingBar extends StatelessWidget {
  final VoidCallback onTap;
  const _StartChantingBar({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          24, 12, 24, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          onTap();
        },
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_saffron, _saffronDeep],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: _saffron.withOpacity(0.45),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('📿', style: TextStyle(fontSize: 20)),
              SizedBox(width: 10),
              Text(
                'Start Chanting',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
