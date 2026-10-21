import 'package:flutter/material.dart';

import '../../core/constants/group_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/group_service.dart';

/// The form that makes a group. Pops `true` once the group exists.
///
/// `useRootNavigator: true` like the other sheets, so it sits over the tab bar.
Future<bool?> showNewGroupSheet(BuildContext context) {
  return showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _NewGroupSheet(),
  );
}

class _NewGroupSheet extends StatefulWidget {
  const _NewGroupSheet();

  @override
  State<_NewGroupSheet> createState() => _NewGroupSheetState();
}

class _NewGroupSheetState extends State<_NewGroupSheet> {
  final _name = TextEditingController();
  final _about = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _about.dispose();
    super.dispose();
  }

  bool get _ready => _name.text.trim().length >= GroupConfig.nameMin && !_busy;

  Future<void> _create() async {
    setState(() => _busy = true);
    try {
      await GroupService.instance.create(name: _name.text.trim(), description: _about.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(text.groupsNew, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _name,
              maxLength: GroupConfig.nameMax,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(labelText: text.groupNameLabel),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _about,
              maxLength: GroupConfig.aboutMax,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(labelText: text.groupAboutLabel),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(text.groupOwnerNote, style: context.texts.bodySmall),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: _ready ? _create : null,
              child: Text(text.groupCreate),
            ),
          ],
        ),
      ),
    );
  }
}
