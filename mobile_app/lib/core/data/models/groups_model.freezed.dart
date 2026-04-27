// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'groups_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GroupModel _$GroupModelFromJson(Map<String, dynamic> json) {
  return _GroupModel.fromJson(json);
}

/// @nodoc
mixin _$GroupModel {
  String get id => throw _privateConstructorUsedError;
  String get sampradayaId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  int get memberCount => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this GroupModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GroupModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GroupModelCopyWith<GroupModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GroupModelCopyWith<$Res> {
  factory $GroupModelCopyWith(
    GroupModel value,
    $Res Function(GroupModel) then,
  ) = _$GroupModelCopyWithImpl<$Res, GroupModel>;
  @useResult
  $Res call({
    String id,
    String sampradayaId,
    String name,
    String description,
    int memberCount,
    bool isActive,
    DateTime createdAt,
  });
}

/// @nodoc
class _$GroupModelCopyWithImpl<$Res, $Val extends GroupModel>
    implements $GroupModelCopyWith<$Res> {
  _$GroupModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GroupModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sampradayaId = null,
    Object? name = null,
    Object? description = null,
    Object? memberCount = null,
    Object? isActive = null,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            sampradayaId: null == sampradayaId
                ? _value.sampradayaId
                : sampradayaId // ignore: cast_nullable_to_non_nullable
                      as String,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            description: null == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String,
            memberCount: null == memberCount
                ? _value.memberCount
                : memberCount // ignore: cast_nullable_to_non_nullable
                      as int,
            isActive: null == isActive
                ? _value.isActive
                : isActive // ignore: cast_nullable_to_non_nullable
                      as bool,
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
abstract class _$$GroupModelImplCopyWith<$Res>
    implements $GroupModelCopyWith<$Res> {
  factory _$$GroupModelImplCopyWith(
    _$GroupModelImpl value,
    $Res Function(_$GroupModelImpl) then,
  ) = __$$GroupModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String sampradayaId,
    String name,
    String description,
    int memberCount,
    bool isActive,
    DateTime createdAt,
  });
}

/// @nodoc
class __$$GroupModelImplCopyWithImpl<$Res>
    extends _$GroupModelCopyWithImpl<$Res, _$GroupModelImpl>
    implements _$$GroupModelImplCopyWith<$Res> {
  __$$GroupModelImplCopyWithImpl(
    _$GroupModelImpl _value,
    $Res Function(_$GroupModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GroupModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sampradayaId = null,
    Object? name = null,
    Object? description = null,
    Object? memberCount = null,
    Object? isActive = null,
    Object? createdAt = null,
  }) {
    return _then(
      _$GroupModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        sampradayaId: null == sampradayaId
            ? _value.sampradayaId
            : sampradayaId // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        description: null == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String,
        memberCount: null == memberCount
            ? _value.memberCount
            : memberCount // ignore: cast_nullable_to_non_nullable
                  as int,
        isActive: null == isActive
            ? _value.isActive
            : isActive // ignore: cast_nullable_to_non_nullable
                  as bool,
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
class _$GroupModelImpl implements _GroupModel {
  const _$GroupModelImpl({
    required this.id,
    required this.sampradayaId,
    required this.name,
    required this.description,
    required this.memberCount,
    required this.isActive,
    required this.createdAt,
  });

  factory _$GroupModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$GroupModelImplFromJson(json);

  @override
  final String id;
  @override
  final String sampradayaId;
  @override
  final String name;
  @override
  final String description;
  @override
  final int memberCount;
  @override
  final bool isActive;
  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'GroupModel(id: $id, sampradayaId: $sampradayaId, name: $name, description: $description, memberCount: $memberCount, isActive: $isActive, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GroupModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.sampradayaId, sampradayaId) ||
                other.sampradayaId == sampradayaId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.memberCount, memberCount) ||
                other.memberCount == memberCount) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    sampradayaId,
    name,
    description,
    memberCount,
    isActive,
    createdAt,
  );

  /// Create a copy of GroupModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GroupModelImplCopyWith<_$GroupModelImpl> get copyWith =>
      __$$GroupModelImplCopyWithImpl<_$GroupModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GroupModelImplToJson(this);
  }
}

abstract class _GroupModel implements GroupModel {
  const factory _GroupModel({
    required final String id,
    required final String sampradayaId,
    required final String name,
    required final String description,
    required final int memberCount,
    required final bool isActive,
    required final DateTime createdAt,
  }) = _$GroupModelImpl;

  factory _GroupModel.fromJson(Map<String, dynamic> json) =
      _$GroupModelImpl.fromJson;

  @override
  String get id;
  @override
  String get sampradayaId;
  @override
  String get name;
  @override
  String get description;
  @override
  int get memberCount;
  @override
  bool get isActive;
  @override
  DateTime get createdAt;

  /// Create a copy of GroupModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GroupModelImplCopyWith<_$GroupModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

GroupMemberModel _$GroupMemberModelFromJson(Map<String, dynamic> json) {
  return _GroupMemberModel.fromJson(json);
}

/// @nodoc
mixin _$GroupMemberModel {
  String get id => throw _privateConstructorUsedError;
  String get groupId => throw _privateConstructorUsedError;
  String get userId => throw _privateConstructorUsedError;
  String get role => throw _privateConstructorUsedError;
  DateTime get joinedAt => throw _privateConstructorUsedError;
  DateTime get lastReadAt => throw _privateConstructorUsedError;

  /// Serializes this GroupMemberModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GroupMemberModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GroupMemberModelCopyWith<GroupMemberModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GroupMemberModelCopyWith<$Res> {
  factory $GroupMemberModelCopyWith(
    GroupMemberModel value,
    $Res Function(GroupMemberModel) then,
  ) = _$GroupMemberModelCopyWithImpl<$Res, GroupMemberModel>;
  @useResult
  $Res call({
    String id,
    String groupId,
    String userId,
    String role,
    DateTime joinedAt,
    DateTime lastReadAt,
  });
}

/// @nodoc
class _$GroupMemberModelCopyWithImpl<$Res, $Val extends GroupMemberModel>
    implements $GroupMemberModelCopyWith<$Res> {
  _$GroupMemberModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GroupMemberModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? groupId = null,
    Object? userId = null,
    Object? role = null,
    Object? joinedAt = null,
    Object? lastReadAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            groupId: null == groupId
                ? _value.groupId
                : groupId // ignore: cast_nullable_to_non_nullable
                      as String,
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            role: null == role
                ? _value.role
                : role // ignore: cast_nullable_to_non_nullable
                      as String,
            joinedAt: null == joinedAt
                ? _value.joinedAt
                : joinedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            lastReadAt: null == lastReadAt
                ? _value.lastReadAt
                : lastReadAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GroupMemberModelImplCopyWith<$Res>
    implements $GroupMemberModelCopyWith<$Res> {
  factory _$$GroupMemberModelImplCopyWith(
    _$GroupMemberModelImpl value,
    $Res Function(_$GroupMemberModelImpl) then,
  ) = __$$GroupMemberModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String groupId,
    String userId,
    String role,
    DateTime joinedAt,
    DateTime lastReadAt,
  });
}

/// @nodoc
class __$$GroupMemberModelImplCopyWithImpl<$Res>
    extends _$GroupMemberModelCopyWithImpl<$Res, _$GroupMemberModelImpl>
    implements _$$GroupMemberModelImplCopyWith<$Res> {
  __$$GroupMemberModelImplCopyWithImpl(
    _$GroupMemberModelImpl _value,
    $Res Function(_$GroupMemberModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GroupMemberModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? groupId = null,
    Object? userId = null,
    Object? role = null,
    Object? joinedAt = null,
    Object? lastReadAt = null,
  }) {
    return _then(
      _$GroupMemberModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        groupId: null == groupId
            ? _value.groupId
            : groupId // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        role: null == role
            ? _value.role
            : role // ignore: cast_nullable_to_non_nullable
                  as String,
        joinedAt: null == joinedAt
            ? _value.joinedAt
            : joinedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        lastReadAt: null == lastReadAt
            ? _value.lastReadAt
            : lastReadAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GroupMemberModelImpl implements _GroupMemberModel {
  const _$GroupMemberModelImpl({
    required this.id,
    required this.groupId,
    required this.userId,
    required this.role,
    required this.joinedAt,
    required this.lastReadAt,
  });

  factory _$GroupMemberModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$GroupMemberModelImplFromJson(json);

  @override
  final String id;
  @override
  final String groupId;
  @override
  final String userId;
  @override
  final String role;
  @override
  final DateTime joinedAt;
  @override
  final DateTime lastReadAt;

  @override
  String toString() {
    return 'GroupMemberModel(id: $id, groupId: $groupId, userId: $userId, role: $role, joinedAt: $joinedAt, lastReadAt: $lastReadAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GroupMemberModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.groupId, groupId) || other.groupId == groupId) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.joinedAt, joinedAt) ||
                other.joinedAt == joinedAt) &&
            (identical(other.lastReadAt, lastReadAt) ||
                other.lastReadAt == lastReadAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, groupId, userId, role, joinedAt, lastReadAt);

  /// Create a copy of GroupMemberModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GroupMemberModelImplCopyWith<_$GroupMemberModelImpl> get copyWith =>
      __$$GroupMemberModelImplCopyWithImpl<_$GroupMemberModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$GroupMemberModelImplToJson(this);
  }
}

abstract class _GroupMemberModel implements GroupMemberModel {
  const factory _GroupMemberModel({
    required final String id,
    required final String groupId,
    required final String userId,
    required final String role,
    required final DateTime joinedAt,
    required final DateTime lastReadAt,
  }) = _$GroupMemberModelImpl;

  factory _GroupMemberModel.fromJson(Map<String, dynamic> json) =
      _$GroupMemberModelImpl.fromJson;

  @override
  String get id;
  @override
  String get groupId;
  @override
  String get userId;
  @override
  String get role;
  @override
  DateTime get joinedAt;
  @override
  DateTime get lastReadAt;

  /// Create a copy of GroupMemberModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GroupMemberModelImplCopyWith<_$GroupMemberModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MessageModel _$MessageModelFromJson(Map<String, dynamic> json) {
  return _MessageModel.fromJson(json);
}

/// @nodoc
mixin _$MessageModel {
  String get id => throw _privateConstructorUsedError;
  String get groupId => throw _privateConstructorUsedError;
  String get userId => throw _privateConstructorUsedError;
  String get content => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  ModerationModel? get moderation => throw _privateConstructorUsedError;
  String? get hiddenReason => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this MessageModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MessageModelCopyWith<MessageModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MessageModelCopyWith<$Res> {
  factory $MessageModelCopyWith(
    MessageModel value,
    $Res Function(MessageModel) then,
  ) = _$MessageModelCopyWithImpl<$Res, MessageModel>;
  @useResult
  $Res call({
    String id,
    String groupId,
    String userId,
    String content,
    String status,
    ModerationModel? moderation,
    String? hiddenReason,
    DateTime createdAt,
  });

  $ModerationModelCopyWith<$Res>? get moderation;
}

/// @nodoc
class _$MessageModelCopyWithImpl<$Res, $Val extends MessageModel>
    implements $MessageModelCopyWith<$Res> {
  _$MessageModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? groupId = null,
    Object? userId = null,
    Object? content = null,
    Object? status = null,
    Object? moderation = freezed,
    Object? hiddenReason = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            groupId: null == groupId
                ? _value.groupId
                : groupId // ignore: cast_nullable_to_non_nullable
                      as String,
            userId: null == userId
                ? _value.userId
                : userId // ignore: cast_nullable_to_non_nullable
                      as String,
            content: null == content
                ? _value.content
                : content // ignore: cast_nullable_to_non_nullable
                      as String,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as String,
            moderation: freezed == moderation
                ? _value.moderation
                : moderation // ignore: cast_nullable_to_non_nullable
                      as ModerationModel?,
            hiddenReason: freezed == hiddenReason
                ? _value.hiddenReason
                : hiddenReason // ignore: cast_nullable_to_non_nullable
                      as String?,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ModerationModelCopyWith<$Res>? get moderation {
    if (_value.moderation == null) {
      return null;
    }

    return $ModerationModelCopyWith<$Res>(_value.moderation!, (value) {
      return _then(_value.copyWith(moderation: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$MessageModelImplCopyWith<$Res>
    implements $MessageModelCopyWith<$Res> {
  factory _$$MessageModelImplCopyWith(
    _$MessageModelImpl value,
    $Res Function(_$MessageModelImpl) then,
  ) = __$$MessageModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String groupId,
    String userId,
    String content,
    String status,
    ModerationModel? moderation,
    String? hiddenReason,
    DateTime createdAt,
  });

  @override
  $ModerationModelCopyWith<$Res>? get moderation;
}

/// @nodoc
class __$$MessageModelImplCopyWithImpl<$Res>
    extends _$MessageModelCopyWithImpl<$Res, _$MessageModelImpl>
    implements _$$MessageModelImplCopyWith<$Res> {
  __$$MessageModelImplCopyWithImpl(
    _$MessageModelImpl _value,
    $Res Function(_$MessageModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? groupId = null,
    Object? userId = null,
    Object? content = null,
    Object? status = null,
    Object? moderation = freezed,
    Object? hiddenReason = freezed,
    Object? createdAt = null,
  }) {
    return _then(
      _$MessageModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        groupId: null == groupId
            ? _value.groupId
            : groupId // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        content: null == content
            ? _value.content
            : content // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as String,
        moderation: freezed == moderation
            ? _value.moderation
            : moderation // ignore: cast_nullable_to_non_nullable
                  as ModerationModel?,
        hiddenReason: freezed == hiddenReason
            ? _value.hiddenReason
            : hiddenReason // ignore: cast_nullable_to_non_nullable
                  as String?,
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
class _$MessageModelImpl implements _MessageModel {
  const _$MessageModelImpl({
    required this.id,
    required this.groupId,
    required this.userId,
    required this.content,
    required this.status,
    this.moderation,
    this.hiddenReason,
    required this.createdAt,
  });

  factory _$MessageModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$MessageModelImplFromJson(json);

  @override
  final String id;
  @override
  final String groupId;
  @override
  final String userId;
  @override
  final String content;
  @override
  final String status;
  @override
  final ModerationModel? moderation;
  @override
  final String? hiddenReason;
  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'MessageModel(id: $id, groupId: $groupId, userId: $userId, content: $content, status: $status, moderation: $moderation, hiddenReason: $hiddenReason, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MessageModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.groupId, groupId) || other.groupId == groupId) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.content, content) || other.content == content) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.moderation, moderation) ||
                other.moderation == moderation) &&
            (identical(other.hiddenReason, hiddenReason) ||
                other.hiddenReason == hiddenReason) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    groupId,
    userId,
    content,
    status,
    moderation,
    hiddenReason,
    createdAt,
  );

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MessageModelImplCopyWith<_$MessageModelImpl> get copyWith =>
      __$$MessageModelImplCopyWithImpl<_$MessageModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MessageModelImplToJson(this);
  }
}

abstract class _MessageModel implements MessageModel {
  const factory _MessageModel({
    required final String id,
    required final String groupId,
    required final String userId,
    required final String content,
    required final String status,
    final ModerationModel? moderation,
    final String? hiddenReason,
    required final DateTime createdAt,
  }) = _$MessageModelImpl;

  factory _MessageModel.fromJson(Map<String, dynamic> json) =
      _$MessageModelImpl.fromJson;

  @override
  String get id;
  @override
  String get groupId;
  @override
  String get userId;
  @override
  String get content;
  @override
  String get status;
  @override
  ModerationModel? get moderation;
  @override
  String? get hiddenReason;
  @override
  DateTime get createdAt;

  /// Create a copy of MessageModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MessageModelImplCopyWith<_$MessageModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ModerationModel _$ModerationModelFromJson(Map<String, dynamic> json) {
  return _ModerationModel.fromJson(json);
}

/// @nodoc
mixin _$ModerationModel {
  String get aiVerdict => throw _privateConstructorUsedError;
  double get aiConfidence => throw _privateConstructorUsedError;
  String? get aiReason => throw _privateConstructorUsedError;
  String? get reviewedByAdmin => throw _privateConstructorUsedError;
  DateTime? get reviewedAt => throw _privateConstructorUsedError;

  /// Serializes this ModerationModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ModerationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ModerationModelCopyWith<ModerationModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ModerationModelCopyWith<$Res> {
  factory $ModerationModelCopyWith(
    ModerationModel value,
    $Res Function(ModerationModel) then,
  ) = _$ModerationModelCopyWithImpl<$Res, ModerationModel>;
  @useResult
  $Res call({
    String aiVerdict,
    double aiConfidence,
    String? aiReason,
    String? reviewedByAdmin,
    DateTime? reviewedAt,
  });
}

/// @nodoc
class _$ModerationModelCopyWithImpl<$Res, $Val extends ModerationModel>
    implements $ModerationModelCopyWith<$Res> {
  _$ModerationModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ModerationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? aiVerdict = null,
    Object? aiConfidence = null,
    Object? aiReason = freezed,
    Object? reviewedByAdmin = freezed,
    Object? reviewedAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            aiVerdict: null == aiVerdict
                ? _value.aiVerdict
                : aiVerdict // ignore: cast_nullable_to_non_nullable
                      as String,
            aiConfidence: null == aiConfidence
                ? _value.aiConfidence
                : aiConfidence // ignore: cast_nullable_to_non_nullable
                      as double,
            aiReason: freezed == aiReason
                ? _value.aiReason
                : aiReason // ignore: cast_nullable_to_non_nullable
                      as String?,
            reviewedByAdmin: freezed == reviewedByAdmin
                ? _value.reviewedByAdmin
                : reviewedByAdmin // ignore: cast_nullable_to_non_nullable
                      as String?,
            reviewedAt: freezed == reviewedAt
                ? _value.reviewedAt
                : reviewedAt // ignore: cast_nullable_to_non_nullable
                      as DateTime?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ModerationModelImplCopyWith<$Res>
    implements $ModerationModelCopyWith<$Res> {
  factory _$$ModerationModelImplCopyWith(
    _$ModerationModelImpl value,
    $Res Function(_$ModerationModelImpl) then,
  ) = __$$ModerationModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String aiVerdict,
    double aiConfidence,
    String? aiReason,
    String? reviewedByAdmin,
    DateTime? reviewedAt,
  });
}

/// @nodoc
class __$$ModerationModelImplCopyWithImpl<$Res>
    extends _$ModerationModelCopyWithImpl<$Res, _$ModerationModelImpl>
    implements _$$ModerationModelImplCopyWith<$Res> {
  __$$ModerationModelImplCopyWithImpl(
    _$ModerationModelImpl _value,
    $Res Function(_$ModerationModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ModerationModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? aiVerdict = null,
    Object? aiConfidence = null,
    Object? aiReason = freezed,
    Object? reviewedByAdmin = freezed,
    Object? reviewedAt = freezed,
  }) {
    return _then(
      _$ModerationModelImpl(
        aiVerdict: null == aiVerdict
            ? _value.aiVerdict
            : aiVerdict // ignore: cast_nullable_to_non_nullable
                  as String,
        aiConfidence: null == aiConfidence
            ? _value.aiConfidence
            : aiConfidence // ignore: cast_nullable_to_non_nullable
                  as double,
        aiReason: freezed == aiReason
            ? _value.aiReason
            : aiReason // ignore: cast_nullable_to_non_nullable
                  as String?,
        reviewedByAdmin: freezed == reviewedByAdmin
            ? _value.reviewedByAdmin
            : reviewedByAdmin // ignore: cast_nullable_to_non_nullable
                  as String?,
        reviewedAt: freezed == reviewedAt
            ? _value.reviewedAt
            : reviewedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ModerationModelImpl implements _ModerationModel {
  const _$ModerationModelImpl({
    required this.aiVerdict,
    required this.aiConfidence,
    this.aiReason,
    this.reviewedByAdmin,
    this.reviewedAt,
  });

  factory _$ModerationModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ModerationModelImplFromJson(json);

  @override
  final String aiVerdict;
  @override
  final double aiConfidence;
  @override
  final String? aiReason;
  @override
  final String? reviewedByAdmin;
  @override
  final DateTime? reviewedAt;

  @override
  String toString() {
    return 'ModerationModel(aiVerdict: $aiVerdict, aiConfidence: $aiConfidence, aiReason: $aiReason, reviewedByAdmin: $reviewedByAdmin, reviewedAt: $reviewedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ModerationModelImpl &&
            (identical(other.aiVerdict, aiVerdict) ||
                other.aiVerdict == aiVerdict) &&
            (identical(other.aiConfidence, aiConfidence) ||
                other.aiConfidence == aiConfidence) &&
            (identical(other.aiReason, aiReason) ||
                other.aiReason == aiReason) &&
            (identical(other.reviewedByAdmin, reviewedByAdmin) ||
                other.reviewedByAdmin == reviewedByAdmin) &&
            (identical(other.reviewedAt, reviewedAt) ||
                other.reviewedAt == reviewedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    aiVerdict,
    aiConfidence,
    aiReason,
    reviewedByAdmin,
    reviewedAt,
  );

  /// Create a copy of ModerationModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ModerationModelImplCopyWith<_$ModerationModelImpl> get copyWith =>
      __$$ModerationModelImplCopyWithImpl<_$ModerationModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ModerationModelImplToJson(this);
  }
}

abstract class _ModerationModel implements ModerationModel {
  const factory _ModerationModel({
    required final String aiVerdict,
    required final double aiConfidence,
    final String? aiReason,
    final String? reviewedByAdmin,
    final DateTime? reviewedAt,
  }) = _$ModerationModelImpl;

  factory _ModerationModel.fromJson(Map<String, dynamic> json) =
      _$ModerationModelImpl.fromJson;

  @override
  String get aiVerdict;
  @override
  double get aiConfidence;
  @override
  String? get aiReason;
  @override
  String? get reviewedByAdmin;
  @override
  DateTime? get reviewedAt;

  /// Create a copy of ModerationModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ModerationModelImplCopyWith<_$ModerationModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
