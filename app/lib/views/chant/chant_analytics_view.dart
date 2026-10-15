import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../../widgets/chant/chant_history_list.dart';
import '../../widgets/chant/chant_mala_report.dart';

/// What [ChantAnalyticsView] opens with: a snapshot of the sitting in
/// progress. A snapshot rather than the recorder itself — the counter is not
/// on screen while this is, so nothing is going to change under it.
class ChantAnalyticsArgs {
  const ChantAnalyticsArgs({
    required this.malas,
    required this.sittingTime,
    required this.beadsPerRound,
    this.mantraId,
    this.mantraName,
  });

  final List<ChantMalaLog> malas;
  final Duration sittingTime;
  final int beadsPerRound;

  /// The mantra being chanted. The history is of this mantra alone; null for a
  /// sitting with none, which is the history of those.
  final String? mantraId;
  final String? mantraName;
}

/// The counter's analytics for one mantra: this sitting round by round, and the
/// sittings before it. Rounds are the finest grain shown — the single chants
/// inside a round are not kept or listed.
class ChantAnalyticsView extends StatelessWidget {
  const ChantAnalyticsView({super.key, required this.args});

  final ChantAnalyticsArgs args;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: args.mantraName == null
              ? Text(text.chantAnalyticsTitle)
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(text.chantAnalyticsTitle),
                    Text(
                      args.mantraName!,
                      style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                    ),
                  ],
                ),
          bottom: TabBar(
            tabs: [
              Tab(text: text.chantTabThisSitting),
              Tab(text: text.chantTabHistory),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            SingleChildScrollView(
              padding: AppSpacing.page,
              child: ChantMalaReport(malas: args.malas, totalTime: args.sittingTime),
            ),
            ChantHistoryList(mantraId: args.mantraId, beadsPerRound: args.beadsPerRound),
          ],
        ),
      ),
    );
  }
}
