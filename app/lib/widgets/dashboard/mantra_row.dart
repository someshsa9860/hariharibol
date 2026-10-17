import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../models/mantra.dart';
import 'mantra_card.dart';

/// The dashboard's horizontal row of mantras.
///
/// A mantra card is as tall as its text, and that depends on the script (Kannada
/// and Devanagari stack taller than Roman), on how many lines the text takes and
/// on the phone's text size. A row given a fixed height is always wrong for one
/// of them — it overflowed by a fraction of a pixel on Kannada. So the row is as
/// tall as its tallest card and every card is stretched to match.
///
/// The feed carries a handful of mantras, so laying them all out at once (rather
/// than lazily, as a long list would) costs nothing.
class MantraRow extends StatelessWidget {
  const MantraRow({super.key, required this.mantras, required this.onOpen});

  final List<Mantra> mantras;
  final ValueChanged<Mantra> onOpen;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < mantras.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.md),
              MantraCard(mantra: mantras[i], onTap: () => onOpen(mantras[i])),
            ],
          ],
        ),
      ),
    );
  }
}
