import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/mantra.dart';
import '../../providers/own_mantra_provider.dart';
import 'mantra_picture_sheet.dart';
import 'own_mantra_problem.dart';

/// What a reader can do with a mantra they added: change its picture (only the
/// one who added it) and take it off their list.
class OwnMantraActions extends ConsumerWidget {
  const OwnMantraActions({super.key, required this.mantra});

  final Mantra mantra;

  Future<void> _changePicture(BuildContext context, WidgetRef ref) async {
    await changeMantraPicture(context, ref, mantra.slug);
  }

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final text = AppLocalizations.of(context);
    final sure = await AppNavigator.instance.confirm(
      title: text.ownMantraRemoveTitle,
      message: text.ownMantraRemoveBody,
      confirmLabel: text.ownMantraRemoveConfirm,
      isDestructive: true,
    );
    if (!sure) return;

    try {
      await ref.read(ownMantraServiceProvider).leave(mantra.slug);
      invalidateMantras(ref.invalidate, slugs: [mantra.slug]);
      AppNavigator.instance.showMessage(text.ownMantraRemoved);
      AppNavigator.instance.pop();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showMessage(ownMantraProblem(text, failure));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        if (mantra.isMine)
          OutlinedButton.icon(
            onPressed: () => _changePicture(context, ref),
            icon: const Icon(Icons.image_outlined),
            label: Text(text.ownMantraChangePicture),
          ),
        OutlinedButton.icon(
          onPressed: () => _remove(context, ref),
          icon: const Icon(Icons.delete_outline_rounded),
          label: Text(text.ownMantraRemove),
        ),
      ],
    );
  }
}
