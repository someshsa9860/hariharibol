import 'dart:io';

import 'package:file_picker/file_picker.dart';

/// A music file the reader picked from the phone's own storage.
class PickedMusic {
  const PickedMusic({required this.path, required this.name, required this.bytes});

  final String path;
  final String name;
  final int bytes;

  /// What the API accepts, from the file's extension; it checks the bytes itself.
  String get contentType {
    final lower = name.toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.wav')) return 'audio/wav';
    return 'audio/mpeg';
  }
}

/// The phone's file picker, behind a service so screens can be tested without
/// one. Music for a reel is read from where the reader keeps it — nothing is
/// copied until the reel is posted.
class ReelMusicPicker {
  ReelMusicPicker._();

  static ReelMusicPicker instance = ReelMusicPicker._();

  /// The largest file the API takes (`AUDIO_MAX_BYTES`).
  static const int maxBytes = 25 * 1024 * 1024;

  /// Null when the reader backs out.
  Future<PickedMusic?> pick() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['mp3', 'm4a', 'mp4', 'aac', 'wav'],
    );
    final path = file?.path;
    if (file == null || path == null) return null;
    return PickedMusic(path: path, name: file.name, bytes: await File(path).length());
  }
}
