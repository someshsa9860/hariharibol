import 'package:freezed_annotation/freezed_annotation.dart';

part 'verse_model.freezed.dart';
part 'verse_model.g.dart';

@freezed
class VerseModel with _$VerseModel {
  const factory VerseModel({
    required String id,
    required String bookId,
    required String chapterId,
    required int verseNumber,
    required String sanskritText,
    required Map<String, String> translations,
    required List<NarrationModel> narrations,
    required List<String> categories,
  }) = _VerseModel;

  factory VerseModel.fromJson(Map<String, dynamic> json) =>
      _$VerseModelFromJson(json);
}

@freezed
class NarrationModel with _$NarrationModel {
  const factory NarrationModel({
    required String id,
    required String saint,
    required String content,
    required String language,
  }) = _NarrationModel;

  factory NarrationModel.fromJson(Map<String, dynamic> json) =>
      _$NarrationModelFromJson(json);
}