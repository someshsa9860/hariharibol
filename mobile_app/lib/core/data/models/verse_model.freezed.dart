// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'verse_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

VerseModel _$VerseModelFromJson(Map<String, dynamic> json) {
  return _VerseModel.fromJson(json);
}

/// @nodoc
mixin _$VerseModel {
  String get id => throw _privateConstructorUsedError;
  String get bookId => throw _privateConstructorUsedError;
  String get chapterId => throw _privateConstructorUsedError;
  int get verseNumber => throw _privateConstructorUsedError;
  String get sanskritText => throw _privateConstructorUsedError;
  Map<String, String> get translations => throw _privateConstructorUsedError;
  List<NarrationModel> get narrations => throw _privateConstructorUsedError;
  List<String> get categories => throw _privateConstructorUsedError;

  /// Serializes this VerseModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of VerseModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $VerseModelCopyWith<VerseModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $VerseModelCopyWith<$Res> {
  factory $VerseModelCopyWith(
    VerseModel value,
    $Res Function(VerseModel) then,
  ) = _$VerseModelCopyWithImpl<$Res, VerseModel>;
  @useResult
  $Res call({
    String id,
    String bookId,
    String chapterId,
    int verseNumber,
    String sanskritText,
    Map<String, String> translations,
    List<NarrationModel> narrations,
    List<String> categories,
  });
}

/// @nodoc
class _$VerseModelCopyWithImpl<$Res, $Val extends VerseModel>
    implements $VerseModelCopyWith<$Res> {
  _$VerseModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of VerseModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? bookId = null,
    Object? chapterId = null,
    Object? verseNumber = null,
    Object? sanskritText = null,
    Object? translations = null,
    Object? narrations = null,
    Object? categories = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            bookId: null == bookId
                ? _value.bookId
                : bookId // ignore: cast_nullable_to_non_nullable
                      as String,
            chapterId: null == chapterId
                ? _value.chapterId
                : chapterId // ignore: cast_nullable_to_non_nullable
                      as String,
            verseNumber: null == verseNumber
                ? _value.verseNumber
                : verseNumber // ignore: cast_nullable_to_non_nullable
                      as int,
            sanskritText: null == sanskritText
                ? _value.sanskritText
                : sanskritText // ignore: cast_nullable_to_non_nullable
                      as String,
            translations: null == translations
                ? _value.translations
                : translations // ignore: cast_nullable_to_non_nullable
                      as Map<String, String>,
            narrations: null == narrations
                ? _value.narrations
                : narrations // ignore: cast_nullable_to_non_nullable
                      as List<NarrationModel>,
            categories: null == categories
                ? _value.categories
                : categories // ignore: cast_nullable_to_non_nullable
                      as List<String>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$VerseModelImplCopyWith<$Res>
    implements $VerseModelCopyWith<$Res> {
  factory _$$VerseModelImplCopyWith(
    _$VerseModelImpl value,
    $Res Function(_$VerseModelImpl) then,
  ) = __$$VerseModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String bookId,
    String chapterId,
    int verseNumber,
    String sanskritText,
    Map<String, String> translations,
    List<NarrationModel> narrations,
    List<String> categories,
  });
}

/// @nodoc
class __$$VerseModelImplCopyWithImpl<$Res>
    extends _$VerseModelCopyWithImpl<$Res, _$VerseModelImpl>
    implements _$$VerseModelImplCopyWith<$Res> {
  __$$VerseModelImplCopyWithImpl(
    _$VerseModelImpl _value,
    $Res Function(_$VerseModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of VerseModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? bookId = null,
    Object? chapterId = null,
    Object? verseNumber = null,
    Object? sanskritText = null,
    Object? translations = null,
    Object? narrations = null,
    Object? categories = null,
  }) {
    return _then(
      _$VerseModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        bookId: null == bookId
            ? _value.bookId
            : bookId // ignore: cast_nullable_to_non_nullable
                  as String,
        chapterId: null == chapterId
            ? _value.chapterId
            : chapterId // ignore: cast_nullable_to_non_nullable
                  as String,
        verseNumber: null == verseNumber
            ? _value.verseNumber
            : verseNumber // ignore: cast_nullable_to_non_nullable
                  as int,
        sanskritText: null == sanskritText
            ? _value.sanskritText
            : sanskritText // ignore: cast_nullable_to_non_nullable
                  as String,
        translations: null == translations
            ? _value._translations
            : translations // ignore: cast_nullable_to_non_nullable
                  as Map<String, String>,
        narrations: null == narrations
            ? _value._narrations
            : narrations // ignore: cast_nullable_to_non_nullable
                  as List<NarrationModel>,
        categories: null == categories
            ? _value._categories
            : categories // ignore: cast_nullable_to_non_nullable
                  as List<String>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$VerseModelImpl implements _VerseModel {
  const _$VerseModelImpl({
    required this.id,
    required this.bookId,
    required this.chapterId,
    required this.verseNumber,
    required this.sanskritText,
    required final Map<String, String> translations,
    required final List<NarrationModel> narrations,
    required final List<String> categories,
  }) : _translations = translations,
       _narrations = narrations,
       _categories = categories;

  factory _$VerseModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$VerseModelImplFromJson(json);

  @override
  final String id;
  @override
  final String bookId;
  @override
  final String chapterId;
  @override
  final int verseNumber;
  @override
  final String sanskritText;
  final Map<String, String> _translations;
  @override
  Map<String, String> get translations {
    if (_translations is EqualUnmodifiableMapView) return _translations;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_translations);
  }

  final List<NarrationModel> _narrations;
  @override
  List<NarrationModel> get narrations {
    if (_narrations is EqualUnmodifiableListView) return _narrations;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_narrations);
  }

  final List<String> _categories;
  @override
  List<String> get categories {
    if (_categories is EqualUnmodifiableListView) return _categories;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_categories);
  }

  @override
  String toString() {
    return 'VerseModel(id: $id, bookId: $bookId, chapterId: $chapterId, verseNumber: $verseNumber, sanskritText: $sanskritText, translations: $translations, narrations: $narrations, categories: $categories)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$VerseModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.bookId, bookId) || other.bookId == bookId) &&
            (identical(other.chapterId, chapterId) ||
                other.chapterId == chapterId) &&
            (identical(other.verseNumber, verseNumber) ||
                other.verseNumber == verseNumber) &&
            (identical(other.sanskritText, sanskritText) ||
                other.sanskritText == sanskritText) &&
            const DeepCollectionEquality().equals(
              other._translations,
              _translations,
            ) &&
            const DeepCollectionEquality().equals(
              other._narrations,
              _narrations,
            ) &&
            const DeepCollectionEquality().equals(
              other._categories,
              _categories,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    bookId,
    chapterId,
    verseNumber,
    sanskritText,
    const DeepCollectionEquality().hash(_translations),
    const DeepCollectionEquality().hash(_narrations),
    const DeepCollectionEquality().hash(_categories),
  );

  /// Create a copy of VerseModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$VerseModelImplCopyWith<_$VerseModelImpl> get copyWith =>
      __$$VerseModelImplCopyWithImpl<_$VerseModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$VerseModelImplToJson(this);
  }
}

abstract class _VerseModel implements VerseModel {
  const factory _VerseModel({
    required final String id,
    required final String bookId,
    required final String chapterId,
    required final int verseNumber,
    required final String sanskritText,
    required final Map<String, String> translations,
    required final List<NarrationModel> narrations,
    required final List<String> categories,
  }) = _$VerseModelImpl;

  factory _VerseModel.fromJson(Map<String, dynamic> json) =
      _$VerseModelImpl.fromJson;

  @override
  String get id;
  @override
  String get bookId;
  @override
  String get chapterId;
  @override
  int get verseNumber;
  @override
  String get sanskritText;
  @override
  Map<String, String> get translations;
  @override
  List<NarrationModel> get narrations;
  @override
  List<String> get categories;

  /// Create a copy of VerseModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$VerseModelImplCopyWith<_$VerseModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

NarrationModel _$NarrationModelFromJson(Map<String, dynamic> json) {
  return _NarrationModel.fromJson(json);
}

/// @nodoc
mixin _$NarrationModel {
  String get id => throw _privateConstructorUsedError;
  String get saint => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get language => throw _privateConstructorUsedError;

  /// Serializes this NarrationModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of NarrationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NarrationModelCopyWith<NarrationModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NarrationModelCopyWith<$Res> {
  factory $NarrationModelCopyWith(
    NarrationModel value,
    $Res Function(NarrationModel) then,
  ) = _$NarrationModelCopyWithImpl<$Res, NarrationModel>;
  @useResult
  $Res call({String id, String saint, String content, String language});
}

/// @nodoc
class _$NarrationModelCopyWithImpl<$Res, $Val extends NarrationModel>
    implements $NarrationModelCopyWith<$Res> {
  _$NarrationModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NarrationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saint = null,
    Object? content = null,
    Object? language = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            saint: null == saint
                ? _value.saint
                : saint // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            language: null == language
                ? _value.language
                : language // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$NarrationModelImplCopyWith<$Res>
    implements $NarrationModelCopyWith<$Res> {
  factory _$$NarrationModelImplCopyWith(
    _$NarrationModelImpl value,
    $Res Function(_$NarrationModelImpl) then,
  ) = __$$NarrationModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String saint, String content, String language});
}

/// @nodoc
class __$$NarrationModelImplCopyWithImpl<$Res>
    extends _$NarrationModelCopyWithImpl<$Res, _$NarrationModelImpl>
    implements _$$NarrationModelImplCopyWith<$Res> {
  __$$NarrationModelImplCopyWithImpl(
    _$NarrationModelImpl _value,
    $Res Function(_$NarrationModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of NarrationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saint = null,
    Object? content = null,
    Object? language = null,
  }) {
    return _then(
      _$NarrationModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        saint: null == saint
            ? _value.saint
            : saint // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        language: null == language
            ? _value.language
            : language // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NarrationModelImpl implements _NarrationModel {
  const _$NarrationModelImpl({
    required this.id,
    required this.saint,
    required this.content,
    required this.language,
  });

  factory _$NarrationModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$NarrationModelImplFromJson(json);

  @override
  final String id;
  @override
  final String saint;
  @override
  final String content;
  @override
  final String language;

  @override
  String toString() {
    return 'NarrationModel(id: $id, saint: $saint, content: $content, language: $language)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NarrationModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.saint, saint) || other.saint == saint) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.language, language) ||
                other.language == language));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, saint, content, language);

  /// Create a copy of NarrationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NarrationModelImplCopyWith<_$NarrationModelImpl> get copyWith =>
      __$$NarrationModelImplCopyWithImpl<_$NarrationModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$NarrationModelImplToJson(this);
  }
}

abstract class _NarrationModel implements NarrationModel {
  const factory _NarrationModel({
    required final String id,
    required final String saint,
    required final String content,
    required final String language,
  }) = _$NarrationModelImpl;

  factory _NarrationModel.fromJson(Map<String, dynamic> json) =
      _$NarrationModelImpl.fromJson;

  @override
  String get id;
  @override
  String get saint;
  @override
  String get content;
  @override
  String get language;

  /// Create a copy of NarrationModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NarrationModelImplCopyWith<_$NarrationModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
