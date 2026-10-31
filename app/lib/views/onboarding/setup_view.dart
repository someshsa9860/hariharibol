import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/routine_plan_config.dart';
import '../../core/constants/routine_presets.dart';
import '../../core/constants/storage_keys.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/language.dart';
import '../../models/mantra.dart';
import '../../providers/language_settings_provider.dart';
import '../../providers/languages_provider.dart';
import '../../providers/mantra_provider.dart';
import '../../providers/routine_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/local_store.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/routine_planner.dart';
import '../../services/sadhana_service.dart';
import '../../services/user_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/routine/routine_limits.dart';
import '../../widgets/routine/routine_style.dart';
import '../../widgets/setup/setup_language_step.dart';
import '../../widgets/setup/setup_mantra_step.dart';
import '../../widgets/setup/setup_rounds_step.dart';
import '../../widgets/setup/setup_routine_step.dart';
import '../../widgets/setup/setup_step_frame.dart';

/// The first-run setup of a new account: the app language, the reading language,
/// a favourite mantra, the daily rounds, and a routine worked out from them.
///
/// Every step answers one question and moves on with one button. Nothing is
/// saved until the last step, except the two languages, which the account needs
/// before its mantra list can be asked in the reader's language.
enum _Step { app, reading, mantra, rounds, routine }

class SetupView extends ConsumerStatefulWidget {
  const SetupView({super.key});

  @override
  ConsumerState<SetupView> createState() => _SetupViewState();
}

class _SetupViewState extends ConsumerState<SetupView> {
  _Step _step = _Step.app;
  String? _appLanguage;
  String? _readingLanguage;
  Mantra? _mantra;
  int _rounds = RoutinePlanConfig.defaultRounds;
  int? _wake;
  int? _bedtime;
  bool _saving = false;

  /// The mantra's own pace, which turns rounds into a time. Zero when no mantra
  /// was picked, and the planner then uses its fallback pace.
  int get _chantMs {
    final mantra = _mantra;
    return mantra == null ? 0 : MantraAutoChantSession.standardChantMsOf(mantra);
  }

  RoutinePlan get _plan => RoutinePlanner.plan(
        rounds: _rounds,
        chantMs: _chantMs,
        wake: _wake,
        bedtime: _bedtime,
      );

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final languages = ref.watch(languagesProvider);

    // What the account already holds is pre-selected, so Continue is live on
    // arrival. Reading follows the app language until the reader picks another.
    final user = ref.watch(currentUserProvider);
    _appLanguage ??= user?.appLanguage;
    _readingLanguage ??= _appLanguage;

    return Scaffold(
      body: SafeArea(
        child: PopScope(
          // Every step but the first backs up one step instead of leaving.
          canPop: _step == _Step.app,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _back();
          },
          child: languages.when(
            loading: () => const AppLoader(),
            error: (error, _) => AppErrorView(
              failure: error is ApiFailure
                  ? error
                  : const ApiFailure(kind: FailureKind.unknown),
              onRetry: () async => ref.invalidate(languagesProvider),
            ),
            data: (_) => _buildStep(text),
          ),
        ),
      ),
    );
  }

  Widget _buildStep(AppLocalizations text) {
    return switch (_step) {
      _Step.app => _frame(
          title: text.languageAppTitle,
          subtitle: text.languageAppSubtitle,
          body: SetupLanguageGrid(
            slot: LanguageSlot.app,
            chosen: _appLanguage,
            onChoose: _chooseApp,
          ),
          footer: _button(
            text.actionContinue,
            _appLanguage == null ? null : _continueApp,
          ),
        ),
      _Step.reading => _frame(
          title: text.languageReadingTitle,
          subtitle: text.languageReadingSubtitle,
          body: SetupLanguageGrid(
            slot: LanguageSlot.reading,
            chosen: _readingLanguage,
            onChoose: _chooseReading,
          ),
          footer: _button(
            text.actionContinue,
            _readingLanguage == null ? null : _continueReading,
          ),
        ),
      _Step.mantra => _frame(
          title: text.setupMantraTitle,
          subtitle: text.setupMantraSubtitle,
          body: SetupMantraList(chosen: _mantra, onChoose: _chooseMantra),
          footer: _mantraFooter(text),
        ),
      _Step.rounds => _frame(
          title: text.setupRoundsTitle,
          subtitle: text.setupRoundsSubtitle,
          body: SetupRoundsStep(
            rounds: _rounds,
            chantMinutes: RoutinePlanner.chantMinutesFor(
              rounds: _rounds,
              chantMs: _chantMs,
            ),
            onChanged: _changeRounds,
          ),
          footer: _button(text.actionContinue, _forward),
        ),
      _Step.routine => _frame(
          title: text.setupRoutineTitle,
          subtitle: _mantra == null
              ? text.setupRoutineSubtitleNoMantra(text.setupRoundsCount(_rounds))
              : text.setupRoutineSubtitle(
                  text.setupRoundsCount(_rounds),
                  _mantra!.name,
                ),
          body: SetupRoutineStep(plan: _plan, onChangeTime: _changeTime),
          footer: _routineFooter(text),
        ),
    };
  }

  SetupStepFrame _frame({
    required String title,
    required String subtitle,
    required Widget body,
    required Widget footer,
  }) {
    return SetupStepFrame(
      step: _step.index,
      title: title,
      subtitle: subtitle,
      body: body,
      footer: footer,
      onBack: _step == _Step.app ? null : _back,
    );
  }

  /// The one button of a step. It is disabled while a save is running, so a
  /// second tap cannot start the same save twice.
  Widget _button(String label, VoidCallback? onPressed) {
    return FilledButton(
      onPressed: _saving ? null : onPressed,
      child: _saving
          ? SizedBox(
              width: AppSizes.iconMd,
              height: AppSizes.iconMd,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: context.colors.onPrimary,
              ),
            )
          : Text(label),
    );
  }

  /// The mantra step can go on once a mantra is picked, or when there is no list
  /// to pick from (empty or failed). The list is watched only here, so the
  /// earlier steps never fetch it in a language the reader has not chosen yet.
  Widget _mantraFooter(AppLocalizations text) {
    return Consumer(
      builder: (context, ref, _) {
        final mantras = ref.watch(mantraListProvider(null));
        final canContinue = _mantra != null ||
            mantras.hasError ||
            (mantras.hasValue && mantras.requireValue.isEmpty);
        return _button(text.actionContinue, canContinue ? _forward : null);
      },
    );
  }

  Widget _routineFooter(AppLocalizations text) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _button(text.setupFinish, () => _finish(withRoutine: true)),
        const SizedBox(height: AppSpacing.sm),
        Center(
          child: TextButton(
            onPressed: _saving ? null : () => _finish(withRoutine: false),
            child: Text(text.setupRoutineSkip),
          ),
        ),
      ],
    );
  }

  void _forward() {
    if (_step == _Step.routine) return;
    setState(() => _step = _Step.values[_step.index + 1]);
  }

  void _back() {
    if (_saving || _step == _Step.app) return;
    setState(() => _step = _Step.values[_step.index - 1]);
  }

  void _continueApp() => setState(() => _step = _Step.reading);

  /// Picking an app language moves the reading language with it, until the
  /// reader picks a reading language of their own on the next step.
  void _chooseApp(String code) {
    if (code == _appLanguage) return;
    setState(() {
      _appLanguage = code;
      _setReading(code);
    });
  }

  void _chooseReading(String code) => setState(() => _setReading(code));

  /// The mantra list is in the reading language, so a mantra picked for another
  /// reading language is cleared.
  void _setReading(String code) {
    if (code != _readingLanguage) _mantra = null;
    _readingLanguage = code;
  }

  Future<void> _continueReading() => _run((_) async {
        final app = _appLanguage!;
        final reading = _readingLanguage!;
        await UserService.instance.updateLanguages(
          appLanguage: app,
          readingLanguage: reading,
          // The mantras are read in the script the reader reads the verses in.
          mantraLanguage: reading,
        );
        // The mantra list is asked in this language from now on, so the
        // device's copy and the account's are changed together.
        await ref.read(languageSettingsProvider.notifier).adopt(
              app: app,
              reading: reading,
            );
        _forward();
      });

  void _chooseMantra(Mantra mantra) => setState(() => _mantra = mantra);

  /// A new count moves the suggested times, so any time moved by hand goes back
  /// to its suggestion.
  void _changeRounds(int rounds) {
    if (rounds == _rounds) return;
    setState(() {
      _rounds = rounds;
      _wake = null;
      _bedtime = null;
    });
  }

  /// A time outside its limit is refused with the reason, and nothing changes.
  void _changeTime(RoutinePreset preset, int minute) {
    final message = routinePresetLimitMessage(context, preset, minute);
    if (message != null) {
      AppNavigator.instance.showMessage(message);
      return;
    }
    setState(() {
      if (preset == RoutinePreset.wakeUp) _wake = minute;
      if (preset == RoutinePreset.sleep) _bedtime = minute;
    });
  }

  /// Saves the rounds and the favourite mantra, and with [withRoutine] creates
  /// the routine's items. Then the setup is marked done and the reader moves on.
  Future<void> _finish({required bool withRoutine}) => _run((text) async {
        final plan = _plan;
        await SadhanaService.instance.updateProfile(
          dailyRoundTarget: _rounds,
          preferredMantraId: _mantra?.id,
        );
        if (withRoutine) {
          final routine = ref.read(routineProvider.notifier);
          for (final item in plan.items) {
            await routine.addDaily(
              title: routinePresetLabel(text, item.preset),
              category: item.preset.category,
              window: item.window,
            );
          }
        }
        // Written only after the save worked, so a failure leaves the reader on
        // the last step with the choices still there.
        await LocalStore.instance.write(BoxKeys.onboardingSeen, true);

        // Setup is the first screen on the stack and has nowhere to go back to.
        // Opened from elsewhere it was pushed, and returns where it came from.
        final navigator = AppNavigator.instance;
        if (navigator.canPop) {
          navigator.pop();
        } else {
          navigator.go(AppRoutes.home);
        }
      });

  /// Runs one save. A second run cannot start while one is going, and a failure
  /// is shown in the app's own words; the reader stays on the step to try again.
  Future<void> _run(Future<void> Function(AppLocalizations text) action) async {
    if (_saving) return;
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;
    setState(() => _saving = true);
    try {
      await action(text);
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    } catch (_) {
      navigator.showMessage(text.errorGeneric);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
