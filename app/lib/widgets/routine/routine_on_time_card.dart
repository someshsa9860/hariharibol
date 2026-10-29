import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/routine_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/routine_alert_provider.dart';
import '../../providers/routine_provider.dart';
import '../../services/routine_alert_plan.dart';

/// Asks the reader to let the routine's alerts come at the very minute — on
/// Android 14 and later "Alarms and reminders" is off for an app until the
/// reader turns it on, and without it Android may hold an alert a few minutes.
///
/// Shown only where it would change something ([RoutineOnTimeAccess.needed]),
/// only while some task has an alert coming, and not again for
/// [RoutineConfig.onTimeAskAgain] after "Not now". Allow opens the system's page
/// for it; the answer is read again on coming back, and the alerts already set
/// become exact ones on the next pass (`RoutineAlerts`). Nothing else changes:
/// without it the alerts still come, a little late at worst.
class RoutineOnTimeCard extends ConsumerStatefulWidget {
  const RoutineOnTimeCard({super.key});

  @override
  ConsumerState<RoutineOnTimeCard> createState() => _RoutineOnTimeCardState();
}

class _RoutineOnTimeCardState extends ConsumerState<RoutineOnTimeCard> with WidgetsBindingObserver {
  /// What the system last said; false until it has answered.
  bool _needed = false;
  bool _asking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_check());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Back from the settings page, or the reader changed it there by hand.
    if (state == AppLifecycleState.resumed) unawaited(_check());
  }

  Future<void> _check() async {
    final needed = await ref.read(routineOnTimeAccessProvider).needed();
    if (mounted && needed != _needed) setState(() => _needed = needed);
  }

  Future<void> _allow() async {
    setState(() => _asking = true);
    await ref.read(routineOnTimeAccessProvider).ask();
    if (!mounted) return;
    setState(() => _asking = false);
    await _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dismissed = ref.watch(routineOnTimeDismissedProvider);
    // Nothing to be on time for: a routine with no time ranges coming.
    final alertsComing = ref.watch(
      routineProvider.select((data) => planRoutineAlerts(data, DateTime.now(), max: 1).isNotEmpty),
    );
    final resting = dismissed != null && DateTime.now().difference(dismissed) < RoutineConfig.onTimeAskAgain;
    if (!_needed || !alertsComing || resting) return const SizedBox.shrink();

    final text = AppLocalizations.of(context);
    return Padding(
      padding: AppSpacing.screenH.copyWith(bottom: AppSpacing.md),
      child: Card(
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.alarm_rounded, size: AppSizes.iconLg, color: context.colors.primary),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(text.routineExactAlarmTitle, style: context.texts.titleMedium),
                        const SizedBox(height: AppSpacing.xs),
                        Text(text.routineExactAlarmBody, style: context.texts.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  TextButton(
                    onPressed: _asking
                        ? null
                        : () => unawaited(ref.read(routineOnTimeDismissedProvider.notifier).dismiss(DateTime.now())),
                    child: Text(text.routineExactAlarmLater),
                  ),
                  FilledButton(
                    // The theme's filled button is full width; here it sits in a row.
                    style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeightSm)),
                    onPressed: _asking ? null : () => unawaited(_allow()),
                    child: Text(text.routineExactAlarmAllow),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
