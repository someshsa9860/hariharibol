import 'json.dart';

/// The numbers on the profile screen.
///
/// Counted server side on request rather than kept in columns — none of them is
/// read often enough to be worth denormalising, and a stale streak is worse
/// than a slightly slower screen.
class UserSummary {
  const UserSummary({
    this.chantingDays = 0,
    this.totalRounds = 0,
    this.tasksCompleted = 0,
    this.favorites = 0,
    this.slokasRead = 0,
  });

  /// Days with at least one round on them, not days since joining.
  final int chantingDays;
  final int totalRounds;
  final int tasksCompleted;
  final int favorites;
  final int slokasRead;

  factory UserSummary.fromJson(Json json) => UserSummary(
        chantingDays: asInt(json['chantingDays']),
        totalRounds: asInt(json['totalRounds']),
        tasksCompleted: asInt(json['tasksCompleted']),
        favorites: asInt(json['favorites']),
        slokasRead: asInt(json['slokasRead']),
      );
}
