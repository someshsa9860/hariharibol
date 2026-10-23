import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/own_mantra_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/own_mantra.dart';
import '../../providers/own_mantra_provider.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/mantra/mantra_picture_sheet.dart';
import '../../widgets/mantra/mantra_text_input.dart';
import '../../widgets/mantra/own_mantra_problem.dart';
import '../../widgets/mantra/own_mantra_results.dart';
import '../../widgets/mantra/suggestion_tile.dart';

/// Adding a mantra that is not in the list.
///
/// The reader types or says it, is shown well-known mantras that match to
/// choose from (up to five), and then sees how each one went. Everything that
/// happens is in `ownMantraProvider`; this only draws it.
class AddMantraView extends ConsumerStatefulWidget {
  const AddMantraView({super.key});

  @override
  ConsumerState<AddMantraView> createState() => _AddMantraViewState();
}

class _AddMantraViewState extends ConsumerState<AddMantraView> {
  final TextEditingController _words = TextEditingController();

  @override
  void dispose() {
    _words.dispose();
    super.dispose();
  }

  OwnMantraNotifier get _notifier => ref.read(ownMantraProvider.notifier);

  Future<void> _changePicture(OwnMantraResult result) async {
    final slug = result.mantra?.slug;
    if (slug == null) return;
    final changed = await changeMantraPicture(context, ref, slug);
    if (changed != null && mounted) _notifier.pictureChanged(changed);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final state = ref.watch(ownMantraProvider);
    final done = state.stage == OwnMantraStage.done;

    return Scaffold(
      appBar: AppBar(title: Text(text.ownMantraAddTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.page,
          children: [
            if (done) ..._results(state, text) else ..._search(state, text),
          ],
        ),
      ),
    );
  }

  List<Widget> _search(OwnMantraState state, AppLocalizations text) {
    final found = state.suggestions;

    return [
      Text(text.ownMantraAddBody, style: context.texts.bodyMedium),
      const SizedBox(height: AppSpacing.xs),
      Text(
        text.ownMantraWellKnownNote,
        style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
      ),
      const SizedBox(height: AppSpacing.lg),
      MantraTextInput(
        controller: _words,
        enabled: !state.busy,
        onFind: () => _notifier.search(_words.text),
      ),
      if (state.failure case final failure?) ...[
        const SizedBox(height: AppSpacing.md),
        _Problem(words: ownMantraProblem(text, failure)),
      ],
      const SizedBox(height: AppSpacing.lg),
      if (state.stage == OwnMantraStage.suggesting)
        const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.xl), child: AppLoader())
      else if (found != null && state.stage != OwnMantraStage.input) ...[
        if (found.items.isEmpty)
          Text(
            text.ownMantraNoneFound,
            style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          )
        else ...[
          Text(
            text.ownMantraChosenCount(state.picked.length, OwnMantraConfig.maxPicks),
            style: context.texts.labelLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in found.items) ...[
            SuggestionTile(
              suggestion: item,
              chosen: state.picked.contains(item.index),
              canChoose: !state.atMostPicked && !state.busy,
              onToggle: () => _notifier.toggle(item),
              onOpen: () => AppNavigator.instance.push(AppRoutes.mantraPath(item.slug!)),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          const SizedBox(height: AppSpacing.sm),
          FilledButton(
            onPressed: state.canAdd ? _notifier.addChosen : null,
            child: state.stage == OwnMantraStage.creating
                ? const AppLoader(size: AppSizes.iconMd)
                : Text(text.ownMantraAddChosen),
          ),
        ],
      ],
    ];
  }

  List<Widget> _results(OwnMantraState state, AppLocalizations text) {
    final names = {
      for (final item in state.suggestions?.items ?? const <MantraSuggestion>[]) item.index: item.name,
    };

    return [
      OwnMantraResults(
        results: state.results,
        names: names,
        onOpen: (slug) => AppNavigator.instance.push(AppRoutes.mantraPath(slug)),
        onChangePicture: _changePicture,
      ),
      const SizedBox(height: AppSpacing.md),
      FilledButton(onPressed: () => AppNavigator.instance.pop(), child: Text(text.actionDone)),
    ];
  }
}

/// A failure, in words and with an icon, under the box it came from.
class _Problem extends StatelessWidget {
  const _Problem({required this.words});

  final String words;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline_rounded, size: AppSizes.iconMd, color: context.colors.error),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Text(words, style: context.texts.bodyMedium?.copyWith(color: context.colors.error))),
      ],
    );
  }
}
