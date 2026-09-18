import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/verse_note.dart';
import '../../providers/verse_notes_provider.dart';
import '../../services/verse_note_service.dart';

/// A reader's own notes on one verse — a running list, not a single field.
/// [onCountChanged] fires after every successful add/edit/delete so the
/// verse's note-count badge can update without the reading screen re-fetching
/// the whole chapter for it; see `verse_block.dart`.
Future<void> showVerseNotesSheet(
  BuildContext context, {
  required String verseId,
  required ValueChanged<int> onCountChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _VerseNotesSheet(verseId: verseId, onCountChanged: onCountChanged),
  );
}

class _VerseNotesSheet extends ConsumerStatefulWidget {
  const _VerseNotesSheet({required this.verseId, required this.onCountChanged});

  final String verseId;
  final ValueChanged<int> onCountChanged;

  @override
  ConsumerState<_VerseNotesSheet> createState() => _VerseNotesSheetState();
}

class _VerseNotesSheetState extends ConsumerState<_VerseNotesSheet> {
  final _controller = TextEditingController();
  String? _editingId;
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _refreshCount() async {
    final notes = await ref.refresh(verseNotesProvider(widget.verseId).future);
    widget.onCountChanged(notes.length);
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _saving) return;

    setState(() => _saving = true);
    try {
      if (_editingId != null) {
        await VerseNoteService.instance.update(_editingId!, text);
      } else {
        await VerseNoteService.instance.add(widget.verseId, text);
      }
      _controller.clear();
      _editingId = null;
      await _refreshCount();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(VerseNote note) async {
    final text = AppLocalizations.of(context);
    final confirmed = await AppNavigator.instance.confirm(
      title: text.verseNoteDeleteConfirm,
      message: note.text,
      confirmLabel: text.actionDelete,
      isDestructive: true,
    );
    if (!confirmed) return;

    try {
      await VerseNoteService.instance.remove(note.id);
      if (_editingId == note.id) {
        _editingId = null;
        _controller.clear();
      }
      await _refreshCount();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  void _startEdit(VerseNote note) {
    setState(() {
      _editingId = note.id;
      _controller.text = note.text;
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final notes = ref.watch(verseNotesProvider(widget.verseId));

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            0,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text.verseNotesTitle, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: notes.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(AppSpacing.xl),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (_, _) => Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Text(text.errorGeneric),
                  ),
                  data: (list) => list.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                          child: Text(
                            text.verseNoteEmpty,
                            style: context.texts.bodyMedium
                                ?.copyWith(color: context.colors.onSurfaceVariant),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          itemCount: list.length,
                          separatorBuilder: (context, index) => const Divider(),
                          itemBuilder: (context, index) {
                            final note = list[index];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(note.text),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: AppSizes.iconSm),
                                    tooltip: text.actionEdit,
                                    onPressed: () => _startEdit(note),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, size: AppSizes.iconSm),
                                    tooltip: text.actionDelete,
                                    onPressed: () => _delete(note),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      decoration: InputDecoration(hintText: text.verseNoteHint),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  IconButton.filled(
                    onPressed: _saving ? null : _submit,
                    icon: _saving
                        ? SizedBox(
                            width: AppSizes.iconSm,
                            height: AppSizes.iconSm,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: context.colors.onPrimary,
                            ),
                          )
                        : const Icon(Icons.send_rounded),
                    tooltip: text.verseNoteAdd,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
