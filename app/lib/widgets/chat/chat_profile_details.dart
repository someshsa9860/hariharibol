import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/sakha_profile.dart';
import '../common/eyebrow.dart';

/// What Sakha has noted about the reader, laid out for reading: each trait under
/// its name, the notes, then the subjects the chats touched.
///
/// The labels are the app's own, in the app's language. The values are the words
/// Sakha wrote and are shown as they are stored — nothing here rewords them.
class ChatProfileDetails extends StatelessWidget {
  const ChatProfileDetails({super.key, required this.profile});

  final SakhaProfile profile;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in profile.fields.entries)
          _Field(label: _labelOf(text, entry.key), value: entry.value),
        if (profile.notes.isNotEmpty) ...[
          _Heading(text.chatProfileNotes),
          for (final note in profile.notes) _Note(note),
        ],
        if (profile.keywords.isNotEmpty) ...[
          _Heading(text.chatProfileKeywords),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [for (final keyword in profile.keywords) Chip(label: Text(keyword))],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            text.chatProfileKeywordsNote,
            style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

String _labelOf(AppLocalizations text, SakhaTrait trait) => switch (trait) {
      SakhaTrait.gender => text.chatProfileGender,
      SakhaTrait.age => text.chatProfileAge,
      SakhaTrait.behaviour => text.chatProfileBehaviour,
      SakhaTrait.lifeStage => text.chatProfileLifeStage,
      SakhaTrait.spiritualStage => text.chatProfileSpiritualStage,
      SakhaTrait.communication => text.chatProfileCommunication,
    };

/// One trait: its name small above what was noted.
class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant)),
          const SizedBox(height: AppSpacing.xxs),
          Text(value, style: context.texts.bodyLarge),
        ],
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.sm),
      child: Eyebrow(title, color: context.colors.onSurfaceVariant),
    );
  }
}

/// A line Sakha chose to remember, with a small mark in front of it.
class _Note extends StatelessWidget {
  const _Note(this.note);

  final String note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            // Level with the first line of the text, whatever its size.
            padding: const EdgeInsets.only(top: AppSpacing.sm, right: AppSpacing.md),
            child: Icon(Icons.circle, size: AppSpacing.sm - AppSpacing.xxs, color: context.colors.onSurfaceVariant),
          ),
          Expanded(child: Text(note, style: context.texts.bodyMedium)),
        ],
      ),
    );
  }
}
