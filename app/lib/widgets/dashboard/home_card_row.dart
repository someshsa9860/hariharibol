import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// A horizontal row of Home cards, each [cardWidth] wide.
///
/// Not a lazy list, and no fixed height: every card is as tall as the tallest
/// one (the rule the mantra row follows), so a larger text size makes the row
/// taller rather than overflowing it. The rows here hold a handful of cards.
class HomeCardRow extends StatelessWidget {
  const HomeCardRow({super.key, required this.cardWidth, required this.children});

  final double cardWidth;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.md),
              SizedBox(width: cardWidth, child: children[i]),
            ],
          ],
        ),
      ),
    );
  }
}
