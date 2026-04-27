// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gurudev_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ChatbotSessionModel _$ChatbotSessionModelFromJson(Map<String, dynamic> json) {
  return _ChatbotSessionModel.fromJson(json);
}

/// @nodoc
mixin _$ChatbotSessionModel {
  String get id => throw _privateConstructorUsedError;
  String get userId => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get guruPersonaUsed => throw _privateConstructorUsedError;
  int get messageCount => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this ChatbotSessionModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChatbotSessionModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatbotSessionModelCopyWith<ChatbotSessionModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatbotSessionModelCopyWith<$Res> {
  factory $ChatbotSessionModelCopyWith(
    ChatbotSessionModel value,
    $Res Function(ChatbotSessionModel) then,
  ) = _$ChatbotSessionModelCopyWithImpl<$Res, ChatbotSessionModel>;
  @useResult
  $Res call({
    String id,
    String userId,
    String title,
    String guruPersonaUsed,
    int messageCount,
    DateTime createdAt,
    DateTime updatedAt,
  });
}

/// @nodoc
class _$ChatbotSessionModelCopyWithImpl<$Res, $Val extends ChatbotSessionModel>
    implements $ChatbotSessionModelCopyWith<$Res> {
  _$ChatbotSessionModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatbotSessionModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? title = null,
    Object? guruPersonaUsed = null,
    Object? messageCount = null,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            title: null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String,
            guruPersonaUsed: null == guruPersonaUsed
                ? _value.guruPersonaUsed
                : guruPersonaUsed // ignore: cast_nullable_to_non_nullable
                      as String,
            messageCount: null == messageCount
                ? _value.messageCount
                : messageCount // ignore: cast_nullable_to_non_nullable
                      as int,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            updatedAt: null == updatedAt
                ? _value.updatedAt
                : updatedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ChatbotSessionModelImplCopyWith<$Res>
    implements $ChatbotSessionModelCopyWith<$Res> {
  factory _$$ChatbotSessionModelImplCopyWith(
    _$ChatbotSessionModelImpl value,
    $Res Function(_$ChatbotSessionModelImpl) then,
  ) = __$$ChatbotSessionModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String userId,
    String title,
    String guruPersonaUsed,
    int messageCount,
    DateTime createdAt,
    DateTime updatedAt,
  });
}

/// @nodoc
class __$$ChatbotSessionModelImplCopyWithImpl<$Res>
    extends _$ChatbotSessionModelCopyWithImpl<$Res, _$ChatbotSessionModelImpl>
    implements _$$ChatbotSessionModelImplCopyWith<$Res> {
  __$$ChatbotSessionModelImplCopyWithImpl(
    _$ChatbotSessionModelImpl _value,
    $Res Function(_$ChatbotSessionModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChatbotSessionModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? title = null,
    Object? guruPersonaUsed = null,
    Object? messageCount = null,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(
      _$ChatbotSessionModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        title: null == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String,
        guruPersonaUsed: null == guruPersonaUsed
            ? _value.guruPersonaUsed
            : guruPersonaUsed // ignore: cast_nullable_to_non_nullable
                  as String,
        messageCount: null == messageCount
            ? _value.messageCount
            : messageCount // ignore: cast_nullable_to_non_nullable
                  as int,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        updatedAt: null == updatedAt
            ? _value.updatedAt
            : updatedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ChatbotSessionModelImpl implements _ChatbotSessionModel {
  const _$ChatbotSessionModelImpl({
    required this.id,
    required this.userId,
    required this.title,
    required this.guruPersonaUsed,
    required this.messageCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory _$ChatbotSessionModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChatbotSessionModelImplFromJson(json);

  @override
  final String id;
  @override
  final String userId;
  @override
  final String title;
  @override
  final String guruPersonaUsed;
  @override
  final int messageCount;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'ChatbotSessionModel(id: $id, userId: $userId, title: $title, guruPersonaUsed: $guruPersonaUsed, messageCount: $messageCount, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatbotSessionModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.guruPersonaUsed, guruPersonaUsed) ||
                other.guruPersonaUsed == guruPersonaUsed) &&
            (identical(other.messageCount, messageCount) ||
                other.messageCount == messageCount) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    userId,
    title,
    guruPersonaUsed,
    messageCount,
    createdAt,
    updatedAt,
  );

  /// Create a copy of ChatbotSessionModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatbotSessionModelImplCopyWith<_$ChatbotSessionModelImpl> get copyWith =>
      __$$ChatbotSessionModelImplCopyWithImpl<_$ChatbotSessionModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ChatbotSessionModelImplToJson(this);
  }
}

abstract class _ChatbotSessionModel implements ChatbotSessionModel {
  const factory _ChatbotSessionModel({
    required final String id,
    required final String userId,
    required final String title,
    required final String guruPersonaUsed,
    required final int messageCount,
    required final DateTime createdAt,
    required final DateTime updatedAt,
  }) = _$ChatbotSessionModelImpl;

  factory _ChatbotSessionModel.fromJson(Map<String, dynamic> json) =
      _$ChatbotSessionModelImpl.fromJson;

  @override
  String get id;
  @override
  String get userId;
  @override
  String get title;
  @override
  String get guruPersonaUsed;
  @override
  int get messageCount;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of ChatbotSessionModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatbotSessionModelImplCopyWith<_$ChatbotSessionModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ChatbotMessageModel _$ChatbotMessageModelFromJson(Map<String, dynamic> json) {
  return _ChatbotMessageModel.fromJson(json);
}

/// @nodoc
mixin _$ChatbotMessageModel {
  String get id => throw _privateConstructorUsedError;
  String get sessionId => throw _privateConstructorUsedError;
  String get role => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  List<CitationModel> get citations => throw _privateConstructorUsedError;
  int? get tokensUsed => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this ChatbotMessageModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChatbotMessageModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatbotMessageModelCopyWith<ChatbotMessageModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatbotMessageModelCopyWith<$Res> {
  factory $ChatbotMessageModelCopyWith(
    ChatbotMessageModel value,
    $Res Function(ChatbotMessageModel) then,
  ) = _$ChatbotMessageModelCopyWithImpl<$Res, ChatbotMessageModel>;
  @useResult
  $Res call({
    String id,
    String sessionId,
    String role,
    String content,
    List<CitationModel> citations,
    int? tokensUsed,
    DateTime createdAt,
  });
}

/// @nodoc
class _$ChatbotMessageModelCopyWithImpl<$Res, $Val extends ChatbotMessageModel>
    implements $ChatbotMessageModelCopyWith<$Res> {
  _$ChatbotMessageModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatbotMessageModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sessionId = null,
    Object? role = null,
    Object? content = null,
    Object? citations = null,
    Object? tokensUsed = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            sessionId: null == sessionId
                ? _value.sessionId
                : sessionId // ignore: cast_nullable_to_non_nullable
                      as String,
            role: null == role
                ? _value.role
                : role // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            citations: null == citations
                ? _value.citations
                : citations // ignore: cast_nullable_to_non_nullable
                      as List<CitationModel>,
            tokensUsed: freezed == tokensUsed
                ? _value.tokensUsed
                : tokensUsed // ignore: cast_nullable_to_non_nullable
                      as int?,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ChatbotMessageModelImplCopyWith<$Res>
    implements $ChatbotMessageModelCopyWith<$Res> {
  factory _$$ChatbotMessageModelImplCopyWith(
    _$ChatbotMessageModelImpl value,
    $Res Function(_$ChatbotMessageModelImpl) then,
  ) = __$$ChatbotMessageModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String sessionId,
    String role,
    String content,
    List<CitationModel> citations,
    int? tokensUsed,
    DateTime createdAt,
  });
}

/// @nodoc
class __$$ChatbotMessageModelImplCopyWithImpl<$Res>
    extends _$ChatbotMessageModelCopyWithImpl<$Res, _$ChatbotMessageModelImpl>
    implements _$$ChatbotMessageModelImplCopyWith<$Res> {
  __$$ChatbotMessageModelImplCopyWithImpl(
    _$ChatbotMessageModelImpl _value,
    $Res Function(_$ChatbotMessageModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChatbotMessageModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sessionId = null,
    Object? role = null,
    Object? content = null,
    Object? citations = null,
    Object? tokensUsed = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _$ChatbotMessageModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        sessionId: null == sessionId
            ? _value.sessionId
            : sessionId // ignore: cast_nullable_to_non_nullable
                  as String,
        role: null == role
            ? _value.role
            : role // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        citations: null == citations
            ? _value._citations
            : citations // ignore: cast_nullable_to_non_nullable
                  as List<CitationModel>,
        tokensUsed: freezed == tokensUsed
            ? _value.tokensUsed
            : tokensUsed // ignore: cast_nullable_to_non_nullable
                  as int?,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ChatbotMessageModelImpl implements _ChatbotMessageModel {
  const _$ChatbotMessageModelImpl({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    required final List<CitationModel> citations,
    this.tokensUsed,
    required this.createdAt,
  }) : _citations = citations;

  factory _$ChatbotMessageModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChatbotMessageModelImplFromJson(json);

  @override
  final String id;
  @override
  final String sessionId;
  @override
  final String role;
  @override
  final String content;
  final List<CitationModel> _citations;
  @override
  List<CitationModel> get citations {
    if (_citations is EqualUnmodifiableListView) return _citations;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_citations);
  }

  @override
  final int? tokensUsed;
  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'ChatbotMessageModel(id: $id, sessionId: $sessionId, role: $role, content: $content, citations: $citations, tokensUsed: $tokensUsed, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatbotMessageModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.sessionId, sessionId) ||
                other.sessionId == sessionId) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.content, content) || other.content == content) &&
            const DeepCollectionEquality().equals(
              other._citations,
              _citations,
            ) &&
            (identical(other.tokensUsed, tokensUsed) ||
                other.tokensUsed == tokensUsed) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    sessionId,
    role,
    content,
    const DeepCollectionEquality().hash(_citations),
    tokensUsed,
    createdAt,
  );

  /// Create a copy of ChatbotMessageModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatbotMessageModelImplCopyWith<_$ChatbotMessageModelImpl> get copyWith =>
      __$$ChatbotMessageModelImplCopyWithImpl<_$ChatbotMessageModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ChatbotMessageModelImplToJson(this);
  }
}

abstract class _ChatbotMessageModel implements ChatbotMessageModel {
  const factory _ChatbotMessageModel({
    required final String id,
    required final String sessionId,
    required final String role,
    required final String content,
    required final List<CitationModel> citations,
    final int? tokensUsed,
    required final DateTime createdAt,
  }) = _$ChatbotMessageModelImpl;

  factory _ChatbotMessageModel.fromJson(Map<String, dynamic> json) =
      _$ChatbotMessageModelImpl.fromJson;

  @override
  String get id;
  @override
  String get sessionId;
  @override
  String get role;
  @override
  String get content;
  @override
  List<CitationModel> get citations;
  @override
  int? get tokensUsed;
  @override
  DateTime get createdAt;

  /// Create a copy of ChatbotMessageModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatbotMessageModelImplCopyWith<_$ChatbotMessageModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CitationModel _$CitationModelFromJson(Map<String, dynamic> json) {
  return _CitationModel.fromJson(json);
}

/// @nodoc
mixin _$CitationModel {
  String get verseId => throw _privateConstructorUsedError;
  String get excerpt => throw _privateConstructorUsedError;

  /// Serializes this CitationModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CitationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CitationModelCopyWith<CitationModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CitationModelCopyWith<$Res> {
  factory $CitationModelCopyWith(
    CitationModel value,
    $Res Function(CitationModel) then,
  ) = _$CitationModelCopyWithImpl<$Res, CitationModel>;
  @useResult
  $Res call({String verseId, String excerpt});
}

/// @nodoc
class _$CitationModelCopyWithImpl<$Res, $Val extends CitationModel>
    implements $CitationModelCopyWith<$Res> {
  _$CitationModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CitationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? verseId = null, Object? excerpt = null}) {
    return _then(
      _value.copyWith(
            verseId: null == verseId
                ? _value.verseId
                : verseId // ignore: cast_nullable_to_non_nullable
                      as String,
            excerpt: null == excerpt
                ? _value.excerpt
                : excerpt // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CitationModelImplCopyWith<$Res>
    implements $CitationModelCopyWith<$Res> {
  factory _$$CitationModelImplCopyWith(
    _$CitationModelImpl value,
    $Res Function(_$CitationModelImpl) then,
  ) = __$$CitationModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String verseId, String excerpt});
}

/// @nodoc
class __$$CitationModelImplCopyWithImpl<$Res>
    extends _$CitationModelCopyWithImpl<$Res, _$CitationModelImpl>
    implements _$$CitationModelImplCopyWith<$Res> {
  __$$CitationModelImplCopyWithImpl(
    _$CitationModelImpl _value,
    $Res Function(_$CitationModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CitationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? verseId = null, Object? excerpt = null}) {
    return _then(
      _$CitationModelImpl(
        verseId: null == verseId
            ? _value.verseId
            : verseId // ignore: cast_nullable_to_non_nullable
                  as String,
        excerpt: null == excerpt
            ? _value.excerpt
            : excerpt // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CitationModelImpl implements _CitationModel {
  const _$CitationModelImpl({required this.verseId, required this.excerpt});

  factory _$CitationModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$CitationModelImplFromJson(json);

  @override
  final String verseId;
  @override
  final String excerpt;

  @override
  String toString() {
    return 'CitationModel(verseId: $verseId, excerpt: $excerpt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CitationModelImpl &&
            (identical(other.verseId, verseId) || other.verseId == verseId) &&
            (identical(other.excerpt, excerpt) || other.excerpt == excerpt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, verseId, excerpt);

  /// Create a copy of CitationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CitationModelImplCopyWith<_$CitationModelImpl> get copyWith =>
      __$$CitationModelImplCopyWithImpl<_$CitationModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CitationModelImplToJson(this);
  }
}

abstract class _CitationModel implements CitationModel {
  const factory _CitationModel({
    required final String verseId,
    required final String excerpt,
  }) = _$CitationModelImpl;

  factory _CitationModel.fromJson(Map<String, dynamic> json) =
      _$CitationModelImpl.fromJson;

  @override
  String get verseId;
  @override
  String get excerpt;

  /// Create a copy of CitationModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CitationModelImplCopyWith<_$CitationModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SuggestedPromptModel _$SuggestedPromptModelFromJson(Map<String, dynamic> json) {
  return _SuggestedPromptModel.fromJson(json);
}

/// @nodoc
mixin _$SuggestedPromptModel {
  String get id => throw _privateConstructorUsedError;
  String get prompt => throw _privateConstructorUsedError;
  String get category => throw _privateConstructorUsedError;

  /// Serializes this SuggestedPromptModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SuggestedPromptModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SuggestedPromptModelCopyWith<SuggestedPromptModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SuggestedPromptModelCopyWith<$Res> {
  factory $SuggestedPromptModelCopyWith(
    SuggestedPromptModel value,
    $Res Function(SuggestedPromptModel) then,
  ) = _$SuggestedPromptModelCopyWithImpl<$Res, SuggestedPromptModel>;
  @useResult
  $Res call({String id, String prompt, String category});
}

/// @nodoc
class _$SuggestedPromptModelCopyWithImpl<
  $Res,
  $Val extends SuggestedPromptModel
>
    implements $SuggestedPromptModelCopyWith<$Res> {
  _$SuggestedPromptModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SuggestedPromptModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? prompt = null,
    Object? category = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            prompt: null == prompt
                ? _value.prompt
                : prompt // ignore: cast_nullable_to_non_nullable
                      as String,
            category: null == category
                ? _value.category
                : category // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$SuggestedPromptModelImplCopyWith<$Res>
    implements $SuggestedPromptModelCopyWith<$Res> {
  factory _$$SuggestedPromptModelImplCopyWith(
    _$SuggestedPromptModelImpl value,
    $Res Function(_$SuggestedPromptModelImpl) then,
  ) = __$$SuggestedPromptModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String prompt, String category});
}

/// @nodoc
class __$$SuggestedPromptModelImplCopyWithImpl<$Res>
    extends _$SuggestedPromptModelCopyWithImpl<$Res, _$SuggestedPromptModelImpl>
    implements _$$SuggestedPromptModelImplCopyWith<$Res> {
  __$$SuggestedPromptModelImplCopyWithImpl(
    _$SuggestedPromptModelImpl _value,
    $Res Function(_$SuggestedPromptModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SuggestedPromptModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? prompt = null,
    Object? category = null,
  }) {
    return _then(
      _$SuggestedPromptModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        prompt: null == prompt
            ? _value.prompt
            : prompt // ignore: cast_nullable_to_non_nullable
                  as String,
        category: null == category
            ? _value.category
            : category // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SuggestedPromptModelImpl implements _SuggestedPromptModel {
  const _$SuggestedPromptModelImpl({
    required this.id,
    required this.prompt,
    required this.category,
  });

  factory _$SuggestedPromptModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$SuggestedPromptModelImplFromJson(json);

  @override
  final String id;
  @override
  final String prompt;
  @override
  final String category;

  @override
  String toString() {
    return 'SuggestedPromptModel(id: $id, prompt: $prompt, category: $category)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SuggestedPromptModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.prompt, prompt) || other.prompt == prompt) &&
            (identical(other.category, category) ||
                other.category == category));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, prompt, category);

  /// Create a copy of SuggestedPromptModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SuggestedPromptModelImplCopyWith<_$SuggestedPromptModelImpl>
  get copyWith =>
      __$$SuggestedPromptModelImplCopyWithImpl<_$SuggestedPromptModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$SuggestedPromptModelImplToJson(this);
  }
}

abstract class _SuggestedPromptModel implements SuggestedPromptModel {
  const factory _SuggestedPromptModel({
    required final String id,
    required final String prompt,
    required final String category,
  }) = _$SuggestedPromptModelImpl;

  factory _SuggestedPromptModel.fromJson(Map<String, dynamic> json) =
      _$SuggestedPromptModelImpl.fromJson;

  @override
  String get id;
  @override
  String get prompt;
  @override
  String get category;

  /// Create a copy of SuggestedPromptModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SuggestedPromptModelImplCopyWith<_$SuggestedPromptModelImpl>
  get copyWith => throw _privateConstructorUsedError;
}
