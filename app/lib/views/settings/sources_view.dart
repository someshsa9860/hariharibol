import 'package:flutter/material.dart';

import '../../core/constants/app_config.dart';
import '../../core/constants/text_sources.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/settings/sources_section.dart';

/// Settings → Sources & disclaimer: whose words the texts are, where they were
/// taken from, that the other languages are AI-assisted, what Sakha is and is
/// not, that the project speaks for no one else, and whom to write to.
///
/// Śrīla Prabhupāda's credit line always shows here — this page is the
/// record of where the texts come from, not the per-verse byline — even
/// while [AppConfig.showAuthorName] keeps his name off the verse, the Home
/// cards and the translation picker until permission to name him there too.
class SourcesView extends StatelessWidget {
  const SourcesView({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    const gap = SizedBox(height: AppSpacing.xl);

    return Scaffold(
      appBar: AppBar(title: Text(text.sourcesTitle, style: context.texts.headlineSmall)),
      body: ListView(
        padding: AppSpacing.page,
        children: [
          Text(text.sourcesIntro, style: context.texts.bodyMedium),
          gap,
          SourcesSection(
            title: text.sourcesTextsHeading,
            children: [
              Text(text.sourcesAuthorCredit, style: context.texts.bodyMedium),
              Text(text.sourcesTextsBody, style: context.texts.bodyMedium),
            ],
          ),
          gap,
          SourcesSection(
            title: text.sourcesFromHeading,
            children: [
              SourceEntry(label: text.sourcesGita, address: TextSources.gita),
              SourceEntry(
                label: text.sourcesBhagavatam(
                  TextSources.bhagavatamEarlyCantos.from,
                  TextSources.bhagavatamEarlyCantos.to,
                ),
                address: TextSources.bhagavatamEarly,
              ),
              SourceEntry(
                label: text.sourcesBhagavatam(
                  TextSources.bhagavatamLateCantos.from,
                  TextSources.bhagavatamLateCantos.to,
                ),
                address: TextSources.bhagavatamLate,
              ),
              SourceEntry(label: text.sourcesDnyaneshwari, address: TextSources.dnyaneshwari),
            ],
          ),
          gap,
          SourcesSection(title: text.sourcesAiHeading, body: text.sourcesAiBody),
          gap,
          SourcesSection(title: text.chatTitle, body: text.sourcesSakhaBody),
          gap,
          SourcesSection(title: text.sourcesIndependentHeading, body: text.sourcesIndependentBody),
          gap,
          SourcesSection(
            title: text.sourcesContactHeading,
            body: text.sourcesContactBody,
            children: [
              SelectableText(
                AppConfig.supportEmail,
                style: context.texts.bodyMedium?.copyWith(color: context.colors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
