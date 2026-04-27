// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sampradaya_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SampradayaModelImpl _$$SampradayaModelImplFromJson(
  Map<String, dynamic> json,
) => _$SampradayaModelImpl(
  id: json['id'] as String,
  slug: json['slug'] as String,
  name: json['name'] as String,
  description: json['description'] as String,
  shortDescription: json['shortDescription'] as String,
  founder: json['founder'] as String,
  founderImageUrl: json['founderImageUrl'] as String,
  primaryDeity: json['primaryDeity'] as String,
  primaryDeityImageUrl: json['primaryDeityImageUrl'] as String,
  philosophy: json['philosophy'] as String,
  keyDisciples: (json['keyDisciples'] as List<dynamic>)
      .map((e) => KeyDiscipleModel.fromJson(e as Map<String, dynamic>))
      .toList(),
  heroImageUrl: json['heroImageUrl'] as String,
  thumbnailUrl: json['thumbnailUrl'] as String,
  categories: (json['categories'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  foundingYear: (json['foundingYear'] as num?)?.toInt(),
  region: json['region'] as String?,
  isPublished: json['isPublished'] as bool,
  displayOrder: (json['displayOrder'] as num).toInt(),
  followerCount: (json['followerCount'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$$SampradayaModelImplToJson(
  _$SampradayaModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'slug': instance.slug,
  'name': instance.name,
  'description': instance.description,
  'shortDescription': instance.shortDescription,
  'founder': instance.founder,
  'founderImageUrl': instance.founderImageUrl,
  'primaryDeity': instance.primaryDeity,
  'primaryDeityImageUrl': instance.primaryDeityImageUrl,
  'philosophy': instance.philosophy,
  'keyDisciples': instance.keyDisciples,
  'heroImageUrl': instance.heroImageUrl,
  'thumbnailUrl': instance.thumbnailUrl,
  'categories': instance.categories,
  'foundingYear': instance.foundingYear,
  'region': instance.region,
  'isPublished': instance.isPublished,
  'displayOrder': instance.displayOrder,
  'followerCount': instance.followerCount,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};

_$KeyDiscipleModelImpl _$$KeyDiscipleModelImplFromJson(
  Map<String, dynamic> json,
) => _$KeyDiscipleModelImpl(
  name: json['name'] as String,
  description: json['description'] as String,
  imageUrl: json['imageUrl'] as String?,
);

Map<String, dynamic> _$$KeyDiscipleModelImplToJson(
  _$KeyDiscipleModelImpl instance,
) => <String, dynamic>{
  'name': instance.name,
  'description': instance.description,
  'imageUrl': instance.imageUrl,
};
