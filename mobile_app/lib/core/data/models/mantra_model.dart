import 'package:freezed_annotation/freezed_annotation.dart';

part 'mantra_model.freezed.dart';
part 'mantra_model.g.dart';

@freezed
class MantraModel with _$MantraModel {
  const factory MantraModel({
    required String id,
    required String sampradayaId,
    required String name,
    required String sanskrit,
    required String transliteration,
    required String meaning,
    required String significance,
    String? audioUrl,
    required bool isPublic,
    int? recommendedCount,
    required String category,
    required String relatedDeity,
    required int displayOrder,
  }) = _MantraModel;

  factory MantraModel.fromJson(Map<String, dynamic> json) =>
      _$MantraModelFromJson(json);
}