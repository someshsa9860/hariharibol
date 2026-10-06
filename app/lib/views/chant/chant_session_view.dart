import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/chant_history_provider.dart';
import '../../widgets/chant/chant_mala_report.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// One past sitting: every mala, and every chant in it.
class ChantSessionView extends ConsumerWidget {
  const ChantSessionView({super.key, required this.sessionId});

  final String sessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final detail = ref.watch(chantSessionDetailProvider(sessionId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          detail.value == null
              ? text.chantSessionTitle
              : formatDateTime(detail.value!.summary.startedAt),
        ),
      ),
      body: detail.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(chantSessionDetailProvider(sessionId)),
        ),
        data: (session) {
          final seconds = session.summary.durationSeconds;
          final anyHeard = session.malas.any((mala) => mala.heardCount > 0);
          return SingleChildScrollView(
            padding: AppSpacing.page,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ChantMalaReport(
                  malas: session.malas,
                  totalTime: seconds == null ? null : Duration(seconds: seconds),
                  emptyMessage: text.chantSessionNoMalas,
                ),
                if (anyHeard) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    text.chantHeardExpiry,
                    textAlign: TextAlign.center,
                    style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
