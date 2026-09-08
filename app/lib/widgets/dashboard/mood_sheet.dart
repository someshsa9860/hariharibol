import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sloka.dart';
import '../common/motif.dart';
import 'verse_hero_card.dart';

/// The verse that came back after someone named what they are struggling with.
///
/// A sheet rather than a page: this is an answer to something asked from the
/// dashboard, and it should close back onto it rather than push a screen the
/// person then has to navigate out of.
Future<void> showMoodSloka(
  BuildContext context, {
  required PersonalSloka sloka,
  required String issueName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _MoodSheet(sloka: sloka, issueName: issueName),
  );
}

class _MoodSheet extends StatelessWidget {
  const _MoodSheet({required this.sloka, required this.issueName});

  final PersonalSloka sloka;
  final String issueName;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: ConstrainedBox(
        // Tall enough to be the screen's subject, short enough that the
        // dashboard behind it is still visible and still the way out.
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            0,
            AppSpacing.lg,
            AppSpacing.xl,
          ),
          child: VerseHeroCard(
            label: issueName,
            verse: sloka.verse,
            reason: sloka.reason,
            motif: Motif.crescent,
          ),
        ),
      ),
    );
  }
}
