import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/socket_provider.dart';
import '../../services/socket_service.dart';

/// "Live", "Connecting…" or "Offline" — whether the websocket is up, with a dot and a word (colour is never the
/// only signal).
class ConnectionDot extends ConsumerWidget {
  const ConnectionDot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final status = ref.watch(socketStatusProvider).value ?? SocketStatus.idle;
    final (label, color) = switch (status) {
      SocketStatus.connected => (text.socketLive, AppTheme.goodColor(context)),
      SocketStatus.connecting => (text.socketConnecting, AppTheme.severityColor(context, 'warning')),
      SocketStatus.offline => (text.socketOffline, AppTheme.severityColor(context, 'warning')),
      SocketStatus.forbidden => (text.socketForbidden, AppTheme.severityColor(context, 'critical')),
      SocketStatus.idle => (text.socketIdle, Theme.of(context).colorScheme.outline),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.circle, size: 10, color: color),
        const SizedBox(width: AppSpacing.xs),
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(width: AppSpacing.sm),
      ],
    );
  }
}
