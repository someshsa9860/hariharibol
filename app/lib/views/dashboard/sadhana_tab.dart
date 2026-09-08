import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../widgets/common/empty_state.dart';

/// Chanting and the day's targets.
///
/// Not built yet — the rounds counter, the chant timer and the task list are
/// the next slice of work. The tab exists so the shell's four branches are real
/// routes rather than a placeholder index.
class SadhanaTab extends ConsumerWidget {
  const SadhanaTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabSadhana)),
      body: Center(
        child: EmptyState(
          message: text.comingSoon,
          icon: Icons.self_improvement_outlined,
        ),
      ),
    );
  }
}
