import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
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
  });

  final List<ChantMalaLog> malas;
  final Duration sittingTime;
  final int beadsPerRound;
}

/// The counter's analytics: this sitting mala by mala, and the ones before it.
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
          title: Text(text.chantAnalyticsTitle),
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
            ChantHistoryList(beadsPerRound: args.beadsPerRound),
          ],
        ),
      ),
    );
  }
}
