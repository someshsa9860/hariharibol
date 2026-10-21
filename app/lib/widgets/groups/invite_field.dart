import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/group_service.dart';

/// The email box an admin invites from.
class InviteField extends StatefulWidget {
  const InviteField({super.key, required this.groupId, required this.onInvited});

  final String groupId;
  final VoidCallback onInvited;

  @override
  State<InviteField> createState() => _InviteFieldState();
}

class _InviteFieldState extends State<InviteField> {
  final _email = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await GroupService.instance.invite(widget.groupId, _email.text.trim());
      _email.clear();
      AppNavigator.instance.showMessage(text.groupInviteSent);
      widget.onInvited();
    } on ApiFailure catch (failure) {
      if (failure.kind == FailureKind.notFound) {
        AppNavigator.instance.showMessage(text.groupInviteNoAccount);
      } else {
        AppNavigator.instance.showFailure(failure);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: InputDecoration(hintText: text.groupInviteHint),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _email.text.contains('@') && !_busy ? _send() : null,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
          onPressed: _busy || !_email.text.contains('@') ? null : _send,
          child: Text(text.groupInviteAction),
        ),
      ],
    );
  }
}
