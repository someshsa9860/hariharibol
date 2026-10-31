import 'dart:async';
import 'dart:isolate';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/routine_config.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/routine_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/routine_alert_service.dart';
import '../../services/routine_alert_ticks.dart';

/// Keeps the routine's task alerts in step with the routine (Android and iOS).
///
/// Each task with a time range gets one notification when the range opens, with
/// a "Mark as done" button ([RoutineAlertService]). This sets them again whenever
/// the routine, the signed-in account or the app's language changes and when the
/// app comes to the front (which also rolls the days ahead forward, and turns the
/// alerts into exact ones when the reader has just allowed that), and writes
/// into the routine whatever was ticked from a button ([RoutineAlertTicks]). It
/// sits above the router, with `PushForeground`, so it is there on every screen,
/// and it is a widget because the words on an alert come from the locale.
///
/// Nothing is shown here and nothing waits on it: a failure to set an alert is
/// logged, never shown.
class RoutineAlerts extends ConsumerStatefulWidget {
  const RoutineAlerts({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<RoutineAlerts> createState() => _RoutineAlertsState();
}

class _RoutineAlertsState extends ConsumerState<RoutineAlerts> with WidgetsBindingObserver {
  ReceivePort? _presses;
  RoutineAlertWords? _words;
  Timer? _debounce;

  bool get _supported => RoutineAlertService.instance.isSupported;

  @override
  void initState() {
    super.initState();
    if (!_supported) return;
    WidgetsBinding.instance.addObserver(this);
    _presses = RoutineAlertTicks.listen(() => unawaited(_takePresses()));
    unawaited(_takePresses());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Also when the app language changes, which renames the channel.
    final strings = AppLocalizations.of(context);
    _words = RoutineAlertWords(
      channelName: strings.routineAlertChannelName,
      body: strings.routineAlertBody,
      doneLabel: strings.routineAlertDone,
    );
    _later();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !_supported) return;
    unawaited(_takePresses());
    _later();
  }

  /// What a button pressed while the app was closed or in the background left.
  Future<void> _takePresses() async {
    final presses = await RoutineAlertTicks.take();
    if (presses.isEmpty || !mounted) return;
    await ref.read(routineProvider.notifier).markDoneFromAlerts(presses);
  }

  /// Sets the alerts a moment from now, so a run of changes is one pass.
  void _later() {
    if (!_supported) return;
    _debounce?.cancel();
    _debounce = Timer(RoutineConfig.alertDebounce, _set);
  }

  void _set() {
    final words = _words;
    // Signed out: nothing to be alerted about, and `_signedOut` has cleared them.
    if (words == null || ref.read(currentUserProvider) == null) return;
    unawaited(RoutineAlertService.instance.sync(ref.read(routineProvider), words));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    final presses = _presses;
    if (presses != null) RoutineAlertTicks.stopListening(presses);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_supported) {
      ref.listen(routineProvider, (_, _) => _later());
      ref.listen(currentUserProvider.select((user) => user?.id), (previous, next) {
        if (next == null) {
          // Someone signed out: the alerts were theirs. (At launch the account is
          // not known yet, and that is not a sign-out — `previous` is null then.)
          if (previous != null) unawaited(RoutineAlertService.instance.cancelAll());
        } else {
          _later();
        }
      });
    }
    return widget.child;
  }
}
