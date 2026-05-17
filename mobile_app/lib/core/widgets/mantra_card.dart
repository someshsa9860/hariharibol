import 'package:flutter/material.dart';

import '../../features/chanting/data/models/mantra_model.dart';

// Reusable mantra card: name, deity/category chip, first meaning line, animated play button
class MantraCard extends StatefulWidget {
  final MantraModel mantra;
  final VoidCallback? onTap;
  final VoidCallback? onPlay;
  final VoidCallback? onFavorite;
  final bool isPlaying;
  final bool isFavorited;

  const MantraCard({
    super.key,
    required this.mantra,
    this.onTap,
    this.onPlay,
    this.onFavorite,
    this.isPlaying = false,
    this.isFavorited = false,
  });

  @override
  State<MantraCard> createState() => _MantraCardState();
}

class _MantraCardState extends State<MantraCard>
    with SingleTickerProviderStateMixin {
  static const _saffron = Color(0xFFFF6B00);
  static const _peacock = Color(0xFF006B6B);
  static const _sandstone = Color(0xFFC4A882);
  static const _gold = Color(0xFFD4A055);
  static const _textDark = Color(0xFF1A1410);
  static const _textMid = Color(0xFF8B7D73);

  late final AnimationController _favCtrl;
  late final Animation<double> _favScale;

  @override
  void initState() {
    super.initState();
    _favCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _favScale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.4), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.4, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _favCtrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _favCtrl.dispose();
    super.dispose();
  }

  void _handleFavorite() {
    _favCtrl.forward(from: 0);
    widget.onFavorite?.call();
  }

  String? get _deityLabel =>
      widget.mantra.sampradayName ?? widget.mantra.category;

  String? get _meaningSnippet {
    final m = widget.mantra.meaning;
    if (m == null || m.isEmpty) return null;
    final line = m.split('.').first.trim();
    return line.length > 80 ? '${line.substring(0, 80)}…' : line;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _sandstone.withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _sandstone.withOpacity(0.35)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.mantra.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: _textDark,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_deityLabel != null) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _peacock.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _peacock.withOpacity(0.3)),
                      ),
                      child: Text(
                        _deityLabel!,
                        style: const TextStyle(
                          color: _peacock,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                  if (_meaningSnippet != null) ...[
                    const SizedBox(height: 5),
                    Text(
                      _meaningSnippet!,
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
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (widget.mantra.recommendationCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: _gold.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.thumb_up_rounded, color: _gold, size: 10),
                        const SizedBox(width: 3),
                        Text(
                          '${widget.mantra.recommendationCount}',
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
                    if (widget.onPlay != null && widget.mantra.audioUrl != null)
                      GestureDetector(
                        onTap: widget.onPlay,
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: widget.isPlaying
                                ? _peacock
                                : _peacock.withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            widget.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: widget.isPlaying ? Colors.white : _peacock,
                            size: 18,
                          ),
                        ),
                      ),
                    if (widget.onFavorite != null) ...[
                      const SizedBox(width: 8),
                      ScaleTransition(
                        scale: _favScale,
                        child: GestureDetector(
                          onTap: _handleFavorite,
                          child: Icon(
                            widget.isFavorited
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            color: widget.isFavorited ? _saffron : _textMid,
                            size: 22,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
