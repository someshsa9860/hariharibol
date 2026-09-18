import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/favorite.dart';

/// A saved verse, mantra or book. All three are one row rather than three
/// widgets — they differ only in which two lines of text they show.
class FavoriteTile extends StatelessWidget {
  const FavoriteTile({super.key, required this.favorite});

  final Favorite favorite;

  @override
  Widget build(BuildContext context) {
    final (String lead, String? sub) = switch (favorite) {
      final f when f.isVerse => (
        f.verse?.sanskrit ?? f.verse?.reference ?? '',
        f.verse?.citation,
      ),
      final f when f.isMantra => (f.mantra?.name ?? '', f.mantra?.text),
      _ => (favorite.book?.title ?? '', null),
    };

    if (lead.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              lead,
              style: context.texts.titleSmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (sub != null && sub.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xxs),
              Text(
                sub,
                style: context.texts.bodySmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
