// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'verse_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$VerseModelImpl _$$VerseModelImplFromJson(Map<String, dynamic> json) =>
    _$VerseModelImpl(
      id: json['id'] as String,
      bookId: json['bookId'] as String,
      chapterId: json['chapterId'] as String,
      verseNumber: (json['verseNumber'] as num).toInt(),
      sanskritText: json['sanskritText'] as String,
      translations: Map<String, String>.from(json['translations'] as Map),
      narrations: (json['narrations'] as List<dynamic>)
          .map((e) => NarrationModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      categories: (json['categories'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$$VerseModelImplToJson(_$VerseModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'bookId': instance.bookId,
      'chapterId': instance.chapterId,
      'verseNumber': instance.verseNumber,
      'sanskritText': instance.sanskritText,
      'translations': instance.translations,
      'narrations': instance.narrations,
      'categories': instance.categories,
    };

_$NarrationModelImpl _$$NarrationModelImplFromJson(Map<String, dynamic> json) =>
    _$NarrationModelImpl(
      id: json['id'] as String,
      saint: json['saint'] as String,
      content: json['content'] as String,
      language: json['language'] as String,
    );

Map<String, dynamic> _$$NarrationModelImplToJson(
  _$NarrationModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'saint': instance.saint,
  'content': instance.content,
  'language': instance.language,
};
