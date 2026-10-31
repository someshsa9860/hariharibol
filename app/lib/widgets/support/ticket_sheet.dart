import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/constants/support_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/language.dart';
import '../../services/support_service.dart';
import 'support_labels.dart';
import 'translation_request_fields.dart';

/// Raising a ticket: a topic, what happened, and an optional screenshot. A translation request names a book and
/// a language instead of needing a message. The phone model and app version go with it without being asked. Pops
/// with true once it is sent.
class TicketSheet extends StatefulWidget {
  const TicketSheet._();

  static Future<bool> show(BuildContext context) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (_) => const TicketSheet._(),
    );
    return sent ?? false;
  }

  @override
  State<TicketSheet> createState() => _TicketSheetState();
}

class _TicketSheetState extends State<TicketSheet> {
  final TextEditingController _message = TextEditingController();
  String _category = SupportConfig.categories.first;
  Book? _book;
  Language? _language;
  Uint8List? _screenshot;
  bool _sending = false;

  bool get _translating => _category == SupportConfig.translationCategory;

  /// A translation needs its book and language; the note is optional. Anything else needs a message.
  bool get _canSend {
    if (_sending) return false;
    if (_translating) return _book != null && _language != null;
    return _message.text.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _message.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _attach() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: SupportConfig.screenshotMaxEdge,
      maxHeight: SupportConfig.screenshotMaxEdge,
      imageQuality: SupportConfig.screenshotQuality,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (mounted) setState(() => _screenshot = bytes);
  }

  Future<void> _send() async {
    if (!_canSend) return;
    final text = AppLocalizations.of(context);
    final book = _book;
    final language = _language;
    setState(() => _sending = true);
    try {
      final shot = _screenshot;
      final key = shot == null ? null : await SupportService.instance.uploadScreenshot(shot, 'image/jpeg');
      await SupportService.instance.create(
        category: _category,
        message: _message.text.trim(),
        screenshotKey: key,
        translation: _translating && book != null && language != null
            ? (bookSlug: book.slug, languageCode: language.code)
            : null,
      );
      if (mounted) Navigator.of(context).pop(true);
      AppNavigator.instance.showMessage(text.supportSent);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
      if (mounted) setState(() => _sending = false);
    }
  }

  String _hintFor(AppLocalizations text) {
    if (_translating) return text.supportTranslationHint;
    if (_category == SupportConfig.featureCategory) return text.supportFeatureHint;
    return text.supportMessageHint;
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final shot = _screenshot;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Padding(
            padding: AppSpacing.card,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text.supportRaiseTicket, style: context.texts.titleLarge),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: InputDecoration(labelText: text.supportCategoryLabel, border: const OutlineInputBorder()),
                  items: [
                    for (final category in SupportConfig.categories)
                      DropdownMenuItem(value: category, child: Text(supportCategoryLabel(text, category))),
                  ],
                  onChanged: (value) => setState(() => _category = value ?? _category),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_translating) ...[
                  TranslationRequestFields(
                    book: _book,
                    language: _language,
                    onBook: (book) => setState(() => _book = book),
                    onLanguage: (language) => setState(() => _language = language),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                TextField(
                  controller: _message,
                  minLines: 4,
                  maxLines: 8,
                  maxLength: SupportConfig.ticketMaxChars,
                  decoration: InputDecoration(hintText: _hintFor(text), border: const OutlineInputBorder()),
                ),
                if (shot != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Image.memory(shot, height: 140, fit: BoxFit.cover),
                  ),
                ],
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: _sending ? null : (shot == null ? _attach : () => setState(() => _screenshot = null)),
                    icon: Icon(shot == null ? Icons.add_photo_alternate_outlined : Icons.close_rounded),
                    label: Text(shot == null ? text.supportAttachScreenshot : text.supportRemoveScreenshot),
                  ),
                ),
                Text(text.supportDeviceNote, style: context.texts.bodySmall),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _canSend ? _send : null,
                    style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
                    child: Text(text.supportSend),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
