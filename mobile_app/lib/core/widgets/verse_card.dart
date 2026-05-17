import 'package:flutter/material.dart';

import '../../features/home/domain/entities/verse_entity.dart';

// Reusable verse card: Sanskrit, transliteration, meaning snippet, reference badge, animated favorite
class VerseCard extends StatefulWidget {
  final VerseEntity verse;
  final VoidCallback? onTap;
  final VoidCallback? onFavorite;
  final bool isFavorited;

  const VerseCard({
    super.key,
    required this.verse,
    this.onTap,
    this.onFavorite,
    this.isFavorited = false,
  });

  @override
  State<VerseCard> createState() => _VerseCardState();
}

class _VerseCardState extends State<VerseCard>
    with SingleTickerProviderStateMixin {
  static const _saffron = Color(0xFFFF6B00);
  static const _saffronDeep = Color(0xFFD96100);
  static const _sandstone = Color(0xFFC4A882);
  static const _textDark = Color(0xFF1C1209);
  static const _textMid = Color(0xFF7A6050);

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

  @override
  Widget build(BuildContext context) {
    final verse = widget.verse;
    final ref = '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}';

    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _sandstone.withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _sandstone.withOpacity(0.35)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _saffron.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    ref,
                    style: const TextStyle(
                      color: _saffronDeep,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const Spacer(),
                if (widget.onFavorite != null)
                  ScaleTransition(
                    scale: _favScale,
                    child: GestureDetector(
                      onTap: _handleFavorite,
                      child: Icon(
                        widget.isFavorited
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: widget.isFavorited ? _saffron : _textMid,
                        size: 20,
                      ),
                    ),
                  ),
              ],
            ),
            if (verse.sanskrit.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                verse.sanskrit,
                style: const TextStyle(
                  fontFamily: 'NotoSansDevanagari',
                  fontSize: 16,
                  color: _textDark,
                  fontWeight: FontWeight.w600,
                  height: 1.7,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (verse.transliteration != null) ...[
              const SizedBox(height: 4),
              Text(
                verse.transliteration!,
                style: const TextStyle(
                  fontStyle: FontStyle.italic,
                  fontSize: 12,
                  color: _textMid,
                  height: 1.4,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (verse.translation != null) ...[
              const SizedBox(height: 6),
              Text(
                verse.translation!,
                style: const TextStyle(
                  color: _textMid,
                  fontSize: 13,
                  height: 1.5,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
