// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notifications_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

NotificationPreferencesModel _$NotificationPreferencesModelFromJson(
  Map<String, dynamic> json,
) {
  return _NotificationPreferencesModel.fromJson(json);
}

/// @nodoc
mixin _$NotificationPreferencesModel {
  bool get verseOfDay => throw _privateConstructorUsedError;
  bool get newContent => throw _privateConstructorUsedError;
  bool get groupMessages => throw _privateConstructorUsedError;
  bool get guruDevUpdates => throw _privateConstructorUsedError;
  bool get chantingReminders => throw _privateConstructorUsedError;

  /// Serializes this NotificationPreferencesModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of NotificationPreferencesModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NotificationPreferencesModelCopyWith<NotificationPreferencesModel>
  get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NotificationPreferencesModelCopyWith<$Res> {
  factory $NotificationPreferencesModelCopyWith(
    NotificationPreferencesModel value,
    $Res Function(NotificationPreferencesModel) then,
  ) =
      _$NotificationPreferencesModelCopyWithImpl<
        $Res,
        NotificationPreferencesModel
      >;
  @useResult
  $Res call({
    bool verseOfDay,
    bool newContent,
    bool groupMessages,
    bool guruDevUpdates,
    bool chantingReminders,
  });
}

/// @nodoc
class _$NotificationPreferencesModelCopyWithImpl<
  $Res,
  $Val extends NotificationPreferencesModel
>
    implements $NotificationPreferencesModelCopyWith<$Res> {
  _$NotificationPreferencesModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NotificationPreferencesModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? verseOfDay = null,
    Object? newContent = null,
    Object? groupMessages = null,
    Object? guruDevUpdates = null,
    Object? chantingReminders = null,
  }) {
    return _then(
      _value.copyWith(
            verseOfDay: null == verseOfDay
                ? _value.verseOfDay
                : verseOfDay // ignore: cast_nullable_to_non_nullable
                      as bool,
            newContent: null == newContent
                ? _value.newContent
                : newContent // ignore: cast_nullable_to_non_nullable
                      as bool,
            groupMessages: null == groupMessages
                ? _value.groupMessages
                : groupMessages // ignore: cast_nullable_to_non_nullable
                      as bool,
            guruDevUpdates: null == guruDevUpdates
                ? _value.guruDevUpdates
                : guruDevUpdates // ignore: cast_nullable_to_non_nullable
                      as bool,
            chantingReminders: null == chantingReminders
                ? _value.chantingReminders
                : chantingReminders // ignore: cast_nullable_to_non_nullable
                      as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$NotificationPreferencesModelImplCopyWith<$Res>
    implements $NotificationPreferencesModelCopyWith<$Res> {
  factory _$$NotificationPreferencesModelImplCopyWith(
    _$NotificationPreferencesModelImpl value,
    $Res Function(_$NotificationPreferencesModelImpl) then,
  ) = __$$NotificationPreferencesModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    bool verseOfDay,
    bool newContent,
    bool groupMessages,
    bool guruDevUpdates,
    bool chantingReminders,
  });
}

/// @nodoc
class __$$NotificationPreferencesModelImplCopyWithImpl<$Res>
    extends
        _$NotificationPreferencesModelCopyWithImpl<
          $Res,
          _$NotificationPreferencesModelImpl
        >
    implements _$$NotificationPreferencesModelImplCopyWith<$Res> {
  __$$NotificationPreferencesModelImplCopyWithImpl(
    _$NotificationPreferencesModelImpl _value,
    $Res Function(_$NotificationPreferencesModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of NotificationPreferencesModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? verseOfDay = null,
    Object? newContent = null,
    Object? groupMessages = null,
    Object? guruDevUpdates = null,
    Object? chantingReminders = null,
  }) {
    return _then(
      _$NotificationPreferencesModelImpl(
        verseOfDay: null == verseOfDay
            ? _value.verseOfDay
            : verseOfDay // ignore: cast_nullable_to_non_nullable
                  as bool,
        newContent: null == newContent
            ? _value.newContent
            : newContent // ignore: cast_nullable_to_non_nullable
                  as bool,
        groupMessages: null == groupMessages
            ? _value.groupMessages
            : groupMessages // ignore: cast_nullable_to_non_nullable
                  as bool,
        guruDevUpdates: null == guruDevUpdates
            ? _value.guruDevUpdates
            : guruDevUpdates // ignore: cast_nullable_to_non_nullable
                  as bool,
        chantingReminders: null == chantingReminders
            ? _value.chantingReminders
            : chantingReminders // ignore: cast_nullable_to_non_nullable
                  as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NotificationPreferencesModelImpl
    implements _NotificationPreferencesModel {
  const _$NotificationPreferencesModelImpl({
    required this.verseOfDay,
    required this.newContent,
    required this.groupMessages,
    required this.guruDevUpdates,
    required this.chantingReminders,
  });

  factory _$NotificationPreferencesModelImpl.fromJson(
    Map<String, dynamic> json,
  ) => _$$NotificationPreferencesModelImplFromJson(json);

  @override
  final bool verseOfDay;
  @override
  final bool newContent;
  @override
  final bool groupMessages;
  @override
  final bool guruDevUpdates;
  @override
  final bool chantingReminders;

  @override
  String toString() {
    return 'NotificationPreferencesModel(verseOfDay: $verseOfDay, newContent: $newContent, groupMessages: $groupMessages, guruDevUpdates: $guruDevUpdates, chantingReminders: $chantingReminders)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NotificationPreferencesModelImpl &&
            (identical(other.verseOfDay, verseOfDay) ||
                other.verseOfDay == verseOfDay) &&
            (identical(other.newContent, newContent) ||
                other.newContent == newContent) &&
            (identical(other.groupMessages, groupMessages) ||
                other.groupMessages == groupMessages) &&
            (identical(other.guruDevUpdates, guruDevUpdates) ||
                other.guruDevUpdates == guruDevUpdates) &&
            (identical(other.chantingReminders, chantingReminders) ||
                other.chantingReminders == chantingReminders));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    verseOfDay,
    newContent,
    groupMessages,
    guruDevUpdates,
    chantingReminders,
  );

  /// Create a copy of NotificationPreferencesModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NotificationPreferencesModelImplCopyWith<
    _$NotificationPreferencesModelImpl
  >
  get copyWith =>
      __$$NotificationPreferencesModelImplCopyWithImpl<
        _$NotificationPreferencesModelImpl
      >(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$NotificationPreferencesModelImplToJson(this);
  }
}

abstract class _NotificationPreferencesModel
    implements NotificationPreferencesModel {
  const factory _NotificationPreferencesModel({
    required final bool verseOfDay,
    required final bool newContent,
    required final bool groupMessages,
    required final bool guruDevUpdates,
    required final bool chantingReminders,
  }) = _$NotificationPreferencesModelImpl;

  factory _NotificationPreferencesModel.fromJson(Map<String, dynamic> json) =
      _$NotificationPreferencesModelImpl.fromJson;

  @override
  bool get verseOfDay;
  @override
  bool get newContent;
  @override
  bool get groupMessages;
  @override
  bool get guruDevUpdates;
  @override
  bool get chantingReminders;

  /// Create a copy of NotificationPreferencesModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NotificationPreferencesModelImplCopyWith<
    _$NotificationPreferencesModelImpl
  >
  get copyWith => throw _privateConstructorUsedError;
}
