import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/storage_keys.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/language.dart';
import '../../providers/language_settings_provider.dart';
import '../../providers/languages_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/local_store.dart';
import '../../services/user_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/eyebrow.dart';

/// Choosing the languages, once, on the first run of a new account.
///
/// Two steps rather than one screen with three pickers: the app language and
/// the chanting script are different questions, and asking them together is how
/// people end up reading English translations in Devanagari by accident.
///
/// The reading language is not asked at all — it follows the app language, and
/// anyone who wants them to differ can say so in settings. Three questions
/// before someone has seen a single verse is too many.
class LanguageView extends ConsumerStatefulWidget {
  const LanguageView({super.key});

  @override
  ConsumerState<LanguageView> createState() => _LanguageViewState();
}

class _LanguageViewState extends ConsumerState<LanguageView> {
  static const int _steps = 2;

  int _step = 0;
  String? _appLanguage;
  String? _mantraLanguage;
  bool _saving = false;

  LanguageSlot get _slot => _step == 0 ? LanguageSlot.app : LanguageSlot.mantra;

  String? get _chosen => _step == 0 ? _appLanguage : _mantraLanguage;

  void _choose(String code) {
    setState(() {
      if (_step == 0) {
        _appLanguage = code;
      } else {
        _mantraLanguage = code;
      }
    });
  }

  Future<void> _next() async {
    if (_chosen == null || _saving) return;

    if (_step < _steps - 1) {
      setState(() => _step++);
      return;
    }

    setState(() => _saving = true);
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;

    try {
      await UserService.instance.updateLanguages(
        appLanguage: _appLanguage,
        mantraLanguage: _mantraLanguage,
        // Meanings follow the app language unless someone changes it later.
        readingLanguage: _appLanguage,
      );

      // The device keeps its own copy of the three languages; onboarding set the
      // app and reading ones, and the speaking language is left to its default.
      await ref.read(languageSettingsProvider.notifier).adopt(
            app: _appLanguage!,
            reading: _appLanguage!,
          );

      // Written only after the API accepted the choice, so a failed save leaves
      // the account on the picker rather than in the app with nothing set.
      await LocalStore.instance.write(BoxKeys.onboardingSeen, true);

      // Onboarding is the first screen on the stack and has nowhere to go back
      // to, so it moves on to the dashboard. Opened from settings it was
      // pushed, and should return where it came from.
      if (navigator.canPop) {
        navigator.pop();
      } else {
        navigator.go(AppRoutes.home);
      }
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    } catch (_) {
      navigator.showMessage(text.errorGeneric);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _back() {
    if (_step > 0) setState(() => _step--);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final languages = ref.watch(languagesProvider);

    // Whatever the account already holds is pre-selected, so Continue is live
    // on arrival and nobody has to re-pick English to get past the screen.
    final user = ref.watch(currentUserProvider);
    _appLanguage ??= user?.appLanguage;
    _mantraLanguage ??= user?.mantraLanguage;

    return Scaffold(
      body: SafeArea(
        child: PopScope(
          // Step two backs up to step one instead of leaving the flow.
          canPop: _step == 0,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _back();
          },
          child: languages.when(
            loading: () => const AppLoader(),
            error: (error, _) => AppErrorView(
              failure: error is ApiFailure
                  ? error
                  : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
              onRetry: () async => ref.invalidate(languagesProvider),
            ),
            data: (_) => _Content(
              step: _step,
              steps: _steps,
              slot: _slot,
              chosen: _chosen,
              saving: _saving,
              onChoose: _choose,
              onNext: _next,
              onBack: _back,
            ),
          ),
        ),
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  const _Content({
    required this.step,
    required this.steps,
    required this.slot,
    required this.chosen,
    required this.saving,
    required this.onChoose,
    required this.onNext,
    required this.onBack,
  });

  final int step;
  final int steps;
  final LanguageSlot slot;
  final String? chosen;
  final bool saving;
  final ValueChanged<String> onChoose;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final options = ref.watch(languagesForSlotProvider(slot));
    final isApp = slot == LanguageSlot.app;

    return Padding(
      padding: AppSpacing.page.copyWith(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (step > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: IconButton(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded),
                tooltip: text.actionBack,
                padding: EdgeInsets.zero,
                alignment: Alignment.centerLeft,
                constraints: const BoxConstraints(minWidth: AppSizes.iconLg),
              ),
            ),

          Eyebrow(text.languageStepOf(step + 1, steps)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            isApp ? text.languageAppTitle : text.languageMantraTitle,
            style: context.texts.headlineMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            isApp ? text.languageAppSubtitle : text.languageMantraSubtitle,
            style: context.texts.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          Expanded(
            child: GridView.builder(
              padding: EdgeInsets.zero,
              itemCount: options.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: AppSpacing.md,
                mainAxisSpacing: AppSpacing.md,
                // A fixed height rather than an aspect ratio: the cards hold
                // two short lines whatever the screen is, and a ratio would
                // make them tall and empty on a tablet.
                mainAxisExtent: 72,
              ),
              itemBuilder: (context, index) {
                final language = options[index];
                return _LanguageCard(
                  language: language,
                  selected: language.code == chosen,
                  onTap: () => onChoose(language.code),
                );
              },
            ),
          ),

          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: chosen == null || saving ? null : onNext,
            child: saving
                ? SizedBox(
                    width: AppSizes.iconMd,
                    height: AppSizes.iconMd,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: context.colors.onPrimary,
                    ),
                  )
                : Text(text.actionContinue),
          ),
        ],
      ),
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final Language language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: '${language.nativeName}, ${language.englishName}',
      child: ExcludeSemantics(
        child: Material(
          color: selected ? context.colors.primaryContainer : context.colors.surfaceContainerLowest,
          borderRadius: AppRadius.mdAll,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.mdAll,
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: selected ? context.colors.primary : context.colors.outlineVariant,
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // The native name leads. Someone looking for their own
                          // language is scanning for their own script, not for
                          // the English word for it.
                          Text(
                            language.nativeName,
                            style: AppTypography.section(context).copyWith(fontSize: 17),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            language.englishName,
                            style: context.texts.bodySmall,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (selected)
                      Icon(
                        Icons.check_rounded,
                        size: AppSizes.iconSm,
                        color: context.colors.primary,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
