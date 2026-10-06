import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';

/// Rounds chanted on physical beads, entered after the fact — the sheet
/// behind the "log rounds" action, for anyone who does not want a phone in
/// hand while chanting.
///
/// No mantra picker here by design: the common case on this sampradaya is one
/// mantra, and a session with no mantra attached is exactly as valid as one
/// with it — the day's total does not need to know which.
///
/// `useRootNavigator: true`: the sadhana tab lives in the dashboard shell's
/// own nested `Navigator`, which `DashboardView` paints underneath the
/// frosted `GlassNavBar` — a sheet opened on that navigator renders behind
/// the bar instead of over it, with no way to dismiss it.
Future<int?> showLogRoundsSheet(BuildContext context) {
  return showModalBottomSheet<int>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _LogRoundsSheet(),
  );
}

class _LogRoundsSheet extends StatefulWidget {
  const _LogRoundsSheet();

  @override
  State<_LogRoundsSheet> createState() => _LogRoundsSheetState();
}

class _LogRoundsSheetState extends State<_LogRoundsSheet> {
  static const List<int> _quickPicks = [1, 2, 4, 8, 16];

  int _rounds = 1;

  void _adjust(int delta) {
    setState(() => _rounds = (_rounds + delta).clamp(1, 200));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text.sadhanaLogRounds, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(
              text.sadhanaLogRoundsSubtitle,
              style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton.filledTonal(
                  onPressed: () => _adjust(-1),
                  icon: const Icon(Icons.remove_rounded),
                ),
                SizedBox(
                  width: 96,
                  child: Text(
                    '$_rounds',
                    textAlign: TextAlign.center,
                    style: AppTypography.numeral(context, size: 48),
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () => _adjust(1),
                  icon: const Icon(Icons.add_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: AppSpacing.sm,
              children: [
                for (final pick in _quickPicks)
                  ChoiceChip(
                    label: Text('$pick'),
                    selected: _rounds == pick,
                    onSelected: (_) => setState(() => _rounds = pick),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_rounds),
                child: Text(text.sadhanaLogRoundsSubmit(_rounds)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
