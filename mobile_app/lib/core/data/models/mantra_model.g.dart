// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mantra_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MantraModelImpl _$$MantraModelImplFromJson(Map<String, dynamic> json) =>
    _$MantraModelImpl(
      id: json['id'] as String,
      sampradayaId: json['sampradayaId'] as String,
      name: json['name'] as String,
      sanskrit: json['sanskrit'] as String,
      transliteration: json['transliteration'] as String,
      meaning: json['meaning'] as String,
      significance: json['significance'] as String,
      audioUrl: json['audioUrl'] as String?,
      isPublic: json['isPublic'] as bool,
      recommendedCount: (json['recommendedCount'] as num?)?.toInt(),
      category: json['category'] as String,
      relatedDeity: json['relatedDeity'] as String,
      displayOrder: (json['displayOrder'] as num).toInt(),
    );

Map<String, dynamic> _$$MantraModelImplToJson(_$MantraModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sampradayaId': instance.sampradayaId,
      'name': instance.name,
      'sanskrit': instance.sanskrit,
      'transliteration': instance.transliteration,
      'meaning': instance.meaning,
      'significance': instance.significance,
      'audioUrl': instance.audioUrl,
      'isPublic': instance.isPublic,
      'recommendedCount': instance.recommendedCount,
      'category': instance.category,
      'relatedDeity': instance.relatedDeity,
      'displayOrder': instance.displayOrder,
    };
