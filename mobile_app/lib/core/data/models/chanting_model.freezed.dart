// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'chanting_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ChantLogModel _$ChantLogModelFromJson(Map<String, dynamic> json) {
  return _ChantLogModel.fromJson(json);
}

/// @nodoc
mixin _$ChantLogModel {
  String get id => throw _privateConstructorUsedError;
  String get userId => throw _privateConstructorUsedError;
  String get mantraId => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;
  int? get durationSeconds => throw _privateConstructorUsedError;
  DateTime get date => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Serializes this ChantLogModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChantLogModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChantLogModelCopyWith<ChantLogModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChantLogModelCopyWith<$Res> {
  factory $ChantLogModelCopyWith(
    ChantLogModel value,
    $Res Function(ChantLogModel) then,
  ) = _$ChantLogModelCopyWithImpl<$Res, ChantLogModel>;
  @useResult
  $Res call({
    String id,
    String userId,
    String mantraId,
    int count,
    int? durationSeconds,
    DateTime date,
    DateTime createdAt,
  });
}

/// @nodoc
class _$ChantLogModelCopyWithImpl<$Res, $Val extends ChantLogModel>
    implements $ChantLogModelCopyWith<$Res> {
  _$ChantLogModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChantLogModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? mantraId = null,
    Object? count = null,
    Object? durationSeconds = freezed,
    Object? date = null,
    Object? createdAt = null,
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
            mantraId: null == mantraId
                ? _value.mantraId
                : mantraId // ignore: cast_nullable_to_non_nullable
                      as String,
            count: null == count
                ? _value.count
                : count // ignore: cast_nullable_to_non_nullable
                      as int,
            durationSeconds: freezed == durationSeconds
                ? _value.durationSeconds
                : durationSeconds // ignore: cast_nullable_to_non_nullable
                      as int?,
            date: null == date
                ? _value.date
                : date // ignore: cast_nullable_to_non_nullable
                      as DateTime,
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
abstract class _$$ChantLogModelImplCopyWith<$Res>
    implements $ChantLogModelCopyWith<$Res> {
  factory _$$ChantLogModelImplCopyWith(
    _$ChantLogModelImpl value,
    $Res Function(_$ChantLogModelImpl) then,
  ) = __$$ChantLogModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String userId,
    String mantraId,
    int count,
    int? durationSeconds,
    DateTime date,
    DateTime createdAt,
  });
}

/// @nodoc
class __$$ChantLogModelImplCopyWithImpl<$Res>
    extends _$ChantLogModelCopyWithImpl<$Res, _$ChantLogModelImpl>
    implements _$$ChantLogModelImplCopyWith<$Res> {
  __$$ChantLogModelImplCopyWithImpl(
    _$ChantLogModelImpl _value,
    $Res Function(_$ChantLogModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChantLogModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? mantraId = null,
    Object? count = null,
    Object? durationSeconds = freezed,
    Object? date = null,
    Object? createdAt = null,
  }) {
    return _then(
      _$ChantLogModelImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        userId: null == userId
            ? _value.userId
            : userId // ignore: cast_nullable_to_non_nullable
                  as String,
        mantraId: null == mantraId
            ? _value.mantraId
            : mantraId // ignore: cast_nullable_to_non_nullable
                  as String,
        count: null == count
            ? _value.count
            : count // ignore: cast_nullable_to_non_nullable
                  as int,
        durationSeconds: freezed == durationSeconds
            ? _value.durationSeconds
            : durationSeconds // ignore: cast_nullable_to_non_nullable
                  as int?,
        date: null == date
            ? _value.date
            : date // ignore: cast_nullable_to_non_nullable
                  as DateTime,
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
class _$ChantLogModelImpl implements _ChantLogModel {
  const _$ChantLogModelImpl({
    required this.id,
    required this.userId,
    required this.mantraId,
    required this.count,
    this.durationSeconds,
    required this.date,
    required this.createdAt,
  });

  factory _$ChantLogModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChantLogModelImplFromJson(json);

  @override
  final String id;
  @override
  final String userId;
  @override
  final String mantraId;
  @override
  final int count;
  @override
  final int? durationSeconds;
  @override
  final DateTime date;
  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'ChantLogModel(id: $id, userId: $userId, mantraId: $mantraId, count: $count, durationSeconds: $durationSeconds, date: $date, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChantLogModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.mantraId, mantraId) ||
                other.mantraId == mantraId) &&
            (identical(other.count, count) || other.count == count) &&
            (identical(other.durationSeconds, durationSeconds) ||
                other.durationSeconds == durationSeconds) &&
            (identical(other.date, date) || other.date == date) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    userId,
    mantraId,
    count,
    durationSeconds,
    date,
    createdAt,
  );

  /// Create a copy of ChantLogModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChantLogModelImplCopyWith<_$ChantLogModelImpl> get copyWith =>
      __$$ChantLogModelImplCopyWithImpl<_$ChantLogModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ChantLogModelImplToJson(this);
  }
}

abstract class _ChantLogModel implements ChantLogModel {
  const factory _ChantLogModel({
    required final String id,
    required final String userId,
    required final String mantraId,
    required final int count,
    final int? durationSeconds,
    required final DateTime date,
    required final DateTime createdAt,
  }) = _$ChantLogModelImpl;

  factory _ChantLogModel.fromJson(Map<String, dynamic> json) =
      _$ChantLogModelImpl.fromJson;

  @override
  String get id;
  @override
  String get userId;
  @override
  String get mantraId;
  @override
  int get count;
  @override
  int? get durationSeconds;
  @override
  DateTime get date;
  @override
  DateTime get createdAt;

  /// Create a copy of ChantLogModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChantLogModelImplCopyWith<_$ChantLogModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ChantStatsModel _$ChantStatsModelFromJson(Map<String, dynamic> json) {
  return _ChantStatsModel.fromJson(json);
}

/// @nodoc
mixin _$ChantStatsModel {
  int get totalChants => throw _privateConstructorUsedError;
  int get totalSessions => throw _privateConstructorUsedError;
  int get totalDurationSeconds => throw _privateConstructorUsedError;
  int get averageSessionChants => throw _privateConstructorUsedError;
  Map<String, int> get dailyStats => throw _privateConstructorUsedError;

  /// Serializes this ChantStatsModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChantStatsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChantStatsModelCopyWith<ChantStatsModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChantStatsModelCopyWith<$Res> {
  factory $ChantStatsModelCopyWith(
    ChantStatsModel value,
    $Res Function(ChantStatsModel) then,
  ) = _$ChantStatsModelCopyWithImpl<$Res, ChantStatsModel>;
  @useResult
  $Res call({
    int totalChants,
    int totalSessions,
    int totalDurationSeconds,
    int averageSessionChants,
    Map<String, int> dailyStats,
  });
}

/// @nodoc
class _$ChantStatsModelCopyWithImpl<$Res, $Val extends ChantStatsModel>
    implements $ChantStatsModelCopyWith<$Res> {
  _$ChantStatsModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChantStatsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalChants = null,
    Object? totalSessions = null,
    Object? totalDurationSeconds = null,
    Object? averageSessionChants = null,
    Object? dailyStats = null,
  }) {
    return _then(
      _value.copyWith(
            totalChants: null == totalChants
                ? _value.totalChants
                : totalChants // ignore: cast_nullable_to_non_nullable
                      as int,
            totalSessions: null == totalSessions
                ? _value.totalSessions
                : totalSessions // ignore: cast_nullable_to_non_nullable
                      as int,
            totalDurationSeconds: null == totalDurationSeconds
                ? _value.totalDurationSeconds
                : totalDurationSeconds // ignore: cast_nullable_to_non_nullable
                      as int,
            averageSessionChants: null == averageSessionChants
                ? _value.averageSessionChants
                : averageSessionChants // ignore: cast_nullable_to_non_nullable
                      as int,
            dailyStats: null == dailyStats
                ? _value.dailyStats
                : dailyStats // ignore: cast_nullable_to_non_nullable
                      as Map<String, int>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ChantStatsModelImplCopyWith<$Res>
    implements $ChantStatsModelCopyWith<$Res> {
  factory _$$ChantStatsModelImplCopyWith(
    _$ChantStatsModelImpl value,
    $Res Function(_$ChantStatsModelImpl) then,
  ) = __$$ChantStatsModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    int totalChants,
    int totalSessions,
    int totalDurationSeconds,
    int averageSessionChants,
    Map<String, int> dailyStats,
  });
}

/// @nodoc
class __$$ChantStatsModelImplCopyWithImpl<$Res>
    extends _$ChantStatsModelCopyWithImpl<$Res, _$ChantStatsModelImpl>
    implements _$$ChantStatsModelImplCopyWith<$Res> {
  __$$ChantStatsModelImplCopyWithImpl(
    _$ChantStatsModelImpl _value,
    $Res Function(_$ChantStatsModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChantStatsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalChants = null,
    Object? totalSessions = null,
    Object? totalDurationSeconds = null,
    Object? averageSessionChants = null,
    Object? dailyStats = null,
  }) {
    return _then(
      _$ChantStatsModelImpl(
        totalChants: null == totalChants
            ? _value.totalChants
            : totalChants // ignore: cast_nullable_to_non_nullable
                  as int,
        totalSessions: null == totalSessions
            ? _value.totalSessions
            : totalSessions // ignore: cast_nullable_to_non_nullable
                  as int,
        totalDurationSeconds: null == totalDurationSeconds
            ? _value.totalDurationSeconds
            : totalDurationSeconds // ignore: cast_nullable_to_non_nullable
                  as int,
        averageSessionChants: null == averageSessionChants
            ? _value.averageSessionChants
            : averageSessionChants // ignore: cast_nullable_to_non_nullable
                  as int,
        dailyStats: null == dailyStats
            ? _value._dailyStats
            : dailyStats // ignore: cast_nullable_to_non_nullable
                  as Map<String, int>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ChantStatsModelImpl implements _ChantStatsModel {
  const _$ChantStatsModelImpl({
    required this.totalChants,
    required this.totalSessions,
    required this.totalDurationSeconds,
    required this.averageSessionChants,
    required final Map<String, int> dailyStats,
  }) : _dailyStats = dailyStats;

  factory _$ChantStatsModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChantStatsModelImplFromJson(json);

  @override
  final int totalChants;
  @override
  final int totalSessions;
  @override
  final int totalDurationSeconds;
  @override
  final int averageSessionChants;
  final Map<String, int> _dailyStats;
  @override
  Map<String, int> get dailyStats {
    if (_dailyStats is EqualUnmodifiableMapView) return _dailyStats;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_dailyStats);
  }

  @override
  String toString() {
    return 'ChantStatsModel(totalChants: $totalChants, totalSessions: $totalSessions, totalDurationSeconds: $totalDurationSeconds, averageSessionChants: $averageSessionChants, dailyStats: $dailyStats)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChantStatsModelImpl &&
            (identical(other.totalChants, totalChants) ||
                other.totalChants == totalChants) &&
            (identical(other.totalSessions, totalSessions) ||
                other.totalSessions == totalSessions) &&
            (identical(other.totalDurationSeconds, totalDurationSeconds) ||
                other.totalDurationSeconds == totalDurationSeconds) &&
            (identical(other.averageSessionChants, averageSessionChants) ||
                other.averageSessionChants == averageSessionChants) &&
            const DeepCollectionEquality().equals(
              other._dailyStats,
              _dailyStats,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    totalChants,
    totalSessions,
    totalDurationSeconds,
    averageSessionChants,
    const DeepCollectionEquality().hash(_dailyStats),
  );

  /// Create a copy of ChantStatsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChantStatsModelImplCopyWith<_$ChantStatsModelImpl> get copyWith =>
      __$$ChantStatsModelImplCopyWithImpl<_$ChantStatsModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ChantStatsModelImplToJson(this);
  }
}

abstract class _ChantStatsModel implements ChantStatsModel {
  const factory _ChantStatsModel({
    required final int totalChants,
    required final int totalSessions,
    required final int totalDurationSeconds,
    required final int averageSessionChants,
    required final Map<String, int> dailyStats,
  }) = _$ChantStatsModelImpl;

  factory _ChantStatsModel.fromJson(Map<String, dynamic> json) =
      _$ChantStatsModelImpl.fromJson;

  @override
  int get totalChants;
  @override
  int get totalSessions;
  @override
  int get totalDurationSeconds;
  @override
  int get averageSessionChants;
  @override
  Map<String, int> get dailyStats;

  /// Create a copy of ChantStatsModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChantStatsModelImplCopyWith<_$ChantStatsModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ChantStreakModel _$ChantStreakModelFromJson(Map<String, dynamic> json) {
  return _ChantStreakModel.fromJson(json);
}

/// @nodoc
mixin _$ChantStreakModel {
  int get currentStreak => throw _privateConstructorUsedError;
  int get longestStreak => throw _privateConstructorUsedError;
  DateTime get lastChantDate => throw _privateConstructorUsedError;

  /// Serializes this ChantStreakModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ChantStreakModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChantStreakModelCopyWith<ChantStreakModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChantStreakModelCopyWith<$Res> {
  factory $ChantStreakModelCopyWith(
    ChantStreakModel value,
    $Res Function(ChantStreakModel) then,
  ) = _$ChantStreakModelCopyWithImpl<$Res, ChantStreakModel>;
  @useResult
  $Res call({int currentStreak, int longestStreak, DateTime lastChantDate});
}

/// @nodoc
class _$ChantStreakModelCopyWithImpl<$Res, $Val extends ChantStreakModel>
    implements $ChantStreakModelCopyWith<$Res> {
  _$ChantStreakModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChantStreakModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStreak = null,
    Object? longestStreak = null,
    Object? lastChantDate = null,
  }) {
    return _then(
      _value.copyWith(
            currentStreak: null == currentStreak
                ? _value.currentStreak
                : currentStreak // ignore: cast_nullable_to_non_nullable
                      as int,
            longestStreak: null == longestStreak
                ? _value.longestStreak
                : longestStreak // ignore: cast_nullable_to_non_nullable
                      as int,
            lastChantDate: null == lastChantDate
                ? _value.lastChantDate
                : lastChantDate // ignore: cast_nullable_to_non_nullable
                      as DateTime,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ChantStreakModelImplCopyWith<$Res>
    implements $ChantStreakModelCopyWith<$Res> {
  factory _$$ChantStreakModelImplCopyWith(
    _$ChantStreakModelImpl value,
    $Res Function(_$ChantStreakModelImpl) then,
  ) = __$$ChantStreakModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int currentStreak, int longestStreak, DateTime lastChantDate});
}

/// @nodoc
class __$$ChantStreakModelImplCopyWithImpl<$Res>
    extends _$ChantStreakModelCopyWithImpl<$Res, _$ChantStreakModelImpl>
    implements _$$ChantStreakModelImplCopyWith<$Res> {
  __$$ChantStreakModelImplCopyWithImpl(
    _$ChantStreakModelImpl _value,
    $Res Function(_$ChantStreakModelImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChantStreakModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStreak = null,
    Object? longestStreak = null,
    Object? lastChantDate = null,
  }) {
    return _then(
      _$ChantStreakModelImpl(
        currentStreak: null == currentStreak
            ? _value.currentStreak
            : currentStreak // ignore: cast_nullable_to_non_nullable
                  as int,
        longestStreak: null == longestStreak
            ? _value.longestStreak
            : longestStreak // ignore: cast_nullable_to_non_nullable
                  as int,
        lastChantDate: null == lastChantDate
            ? _value.lastChantDate
            : lastChantDate // ignore: cast_nullable_to_non_nullable
                  as DateTime,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ChantStreakModelImpl implements _ChantStreakModel {
  const _$ChantStreakModelImpl({
    required this.currentStreak,
    required this.longestStreak,
    required this.lastChantDate,
  });

  factory _$ChantStreakModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$ChantStreakModelImplFromJson(json);

  @override
  final int currentStreak;
  @override
  final int longestStreak;
  @override
  final DateTime lastChantDate;

  @override
  String toString() {
    return 'ChantStreakModel(currentStreak: $currentStreak, longestStreak: $longestStreak, lastChantDate: $lastChantDate)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChantStreakModelImpl &&
            (identical(other.currentStreak, currentStreak) ||
                other.currentStreak == currentStreak) &&
            (identical(other.longestStreak, longestStreak) ||
                other.longestStreak == longestStreak) &&
            (identical(other.lastChantDate, lastChantDate) ||
                other.lastChantDate == lastChantDate));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, currentStreak, longestStreak, lastChantDate);

  /// Create a copy of ChantStreakModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChantStreakModelImplCopyWith<_$ChantStreakModelImpl> get copyWith =>
      __$$ChantStreakModelImplCopyWithImpl<_$ChantStreakModelImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ChantStreakModelImplToJson(this);
  }
}

abstract class _ChantStreakModel implements ChantStreakModel {
  const factory _ChantStreakModel({
    required final int currentStreak,
    required final int longestStreak,
    required final DateTime lastChantDate,
  }) = _$ChantStreakModelImpl;

  factory _ChantStreakModel.fromJson(Map<String, dynamic> json) =
      _$ChantStreakModelImpl.fromJson;

  @override
  int get currentStreak;
  @override
  int get longestStreak;
  @override
  DateTime get lastChantDate;

  /// Create a copy of ChantStreakModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChantStreakModelImplCopyWith<_$ChantStreakModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
