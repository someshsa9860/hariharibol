import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sloka.dart';
import '../../models/verse.dart';
import '../common/motif.dart';
import 'verse_hero_card.dart';

/// One verse per mood picked, in the order they were picked.
typedef MoodSlokaResult = ({String label, PersonalSloka sloka});

/// The verse(s) that came back after someone named what they are struggling
/// with.
///
/// A sheet rather than a page: this is an answer to something asked from the
/// dashboard, and it should close back onto it rather than push a screen the
/// person then has to navigate out of.
///
/// `useRootNavigator: true` because the home tab lives in the dashboard
/// shell's own nested `Navigator`, which `DashboardView` paints underneath
/// the frosted `GlassNavBar` — a sheet opened on that navigator would render
/// behind the bar instead of over it, with no way to dismiss it. Pushing to
/// the root navigator puts it above the whole shell instead, same as the reel
/// comments and report sheets do for the same reason.
Future<void> showMoodSlokas(
  BuildContext context, {
  required List<MoodSlokaResult> results,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    showDragHandle: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _MoodSheet(results: results),
  );
}

class _MoodSheet extends StatelessWidget {
  const _MoodSheet({required this.results});

  final List<MoodSlokaResult> results;

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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < results.length; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.lg),
                VerseHeroCard(
                  label: results[i].label,
                  verse: results[i].sloka.verse,
                  reason: results[i].sloka.reason,
                  motif: Motif.crescent,
                  onTap: _openVerse(context, results[i].sloka.verse),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Null when the verse has nowhere to open, same as the home cards. The sheet
/// closes first — the destination is a full reading screen, not something to
/// leave stacked behind an answer someone has already read.
VoidCallback? _openVerse(BuildContext context, Verse verse) {
  final path = verse.readingPath;
  if (path == null) return null;
  return () {
    Navigator.of(context).pop();
    AppNavigator.instance.push(path);
  };
}
