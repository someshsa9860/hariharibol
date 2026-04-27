import 'package:freezed_annotation/freezed_annotation.dart';

part 'sampradaya_model.freezed.dart';
part 'sampradaya_model.g.dart';

@freezed
class SampradayaModel with _$SampradayaModel {
  const factory SampradayaModel({
    required String id,
    required String slug,
    required String name,
    required String description,
    required String shortDescription,
    required String founder,
    required String founderImageUrl,
    required String primaryDeity,
    required String primaryDeityImageUrl,
    required String philosophy,
    required List<KeyDiscipleModel> keyDisciples,
    required String heroImageUrl,
    required String thumbnailUrl,
    required List<String> categories,
    int? foundingYear,
    String? region,
    required bool isPublished,
    required int displayOrder,
    required int followerCount,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _SampradayaModel;

  factory SampradayaModel.fromJson(Map<String, dynamic> json) =>
      _$SampradayaModelFromJson(json);
}

@freezed
class KeyDiscipleModel with _$KeyDiscipleModel {
  const factory KeyDiscipleModel({
    required String name,
    required String description,
    String? imageUrl,
  }) = _KeyDiscipleModel;

  factory KeyDiscipleModel.fromJson(Map<String, dynamic> json) =>
      _$KeyDiscipleModelFromJson(json);
}