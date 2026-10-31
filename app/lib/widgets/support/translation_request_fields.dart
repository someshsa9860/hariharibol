import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../../models/language.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../../providers/languages_provider.dart';

/// The book and the reading language a translation request names, picked from what the app offers. The sheet
/// keeps the choices; this only shows them.
class TranslationRequestFields extends ConsumerWidget {
  const TranslationRequestFields({
    required this.book,
    required this.language,
    required this.onBook,
    required this.onLanguage,
    super.key,
  });

  final Book? book;
  final Language? language;
  final ValueChanged<Book?> onBook;
  final ValueChanged<Language?> onLanguage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);
    final books = ref.watch(booksProvider).value ?? const <Book>[];
    final languages = ref.watch(languagesForSlotProvider(LanguageSlot.reading));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text.supportTranslationIntro, style: context.texts.bodySmall),
        const SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<Book>(
          initialValue: book,
          decoration: InputDecoration(labelText: text.supportBookLabel, border: const OutlineInputBorder()),
          items: [
            for (final item in books)
              DropdownMenuItem(value: item, child: Text(item.titleFor(chain), overflow: TextOverflow.ellipsis)),
          ],
          onChanged: onBook,
        ),
        const SizedBox(height: AppSpacing.md),
        DropdownButtonFormField<Language>(
          initialValue: language,
          decoration: InputDecoration(labelText: text.supportLanguageLabel, border: const OutlineInputBorder()),
          items: [
            for (final item in languages) DropdownMenuItem(value: item, child: Text(item.nativeName)),
          ],
          onChanged: onLanguage,
        ),
      ],
    );
  }
}
