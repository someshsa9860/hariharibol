import '../../../home/domain/entities/sampraday_entity.dart';

class SampradayModel extends SampradayEntity {
  const SampradayModel({
    required String id,
    required String slug,
    required String name,
    String? description,
    String? thumbnailUrl,
    required int followerCount,
  }) : super(
    id: id,
    slug: slug,
    name: name,
    description: description,
    thumbnailUrl: thumbnailUrl,
    followerCount: followerCount,
  );

  factory SampradayModel.fromJson(Map<String, dynamic> json) {
    return SampradayModel(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['nameKey'] as String? ?? 'Unknown',
      description: json['descriptionKey'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      followerCount: json['followerCount'] as int? ?? 0,
    );
  }
}
