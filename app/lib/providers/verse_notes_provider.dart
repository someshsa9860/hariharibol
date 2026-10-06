import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/verse_note.dart';
import '../services/verse_note_service.dart';

/// One verse's notes, keyed by verse id.
///
/// A plain family rather than a notifier that owns mutations: adding, editing
/// or deleting a note calls [VerseNoteService] directly and then
/// `ref.invalidate`s this provider for that verse id, the same pattern
/// `library_tab.dart` already uses for `booksProvider` — simpler than a
/// second state-holding layer for a list this small.
final verseNotesProvider = FutureProvider.family.autoDispose<List<VerseNote>, String>((ref, verseId) {
  return VerseNoteService.instance.list(verseId);
});
