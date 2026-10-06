import 'json.dart';

/// A creator's public profile.
///
/// Fuller than the `ReelCreator` carried on a feed card: the bio, the cover
/// image and the three counts are only worth fetching when someone actually
/// opens the profile, which is why the feed does not carry them.
class Creator {
  const Creator({
    required this.id,
    required this.displayName,
    this.bio,
    this.avatarUrl,
    this.coverImageUrl,
    this.isVerified = false,
    this.followerCount = 0,
    this.reelCount = 0,
    this.totalViews = 0,
    this.isFollowing = false,
    this.isMe = false,
  });

  final String id;
  final String displayName;
  final String? bio;
  final String? avatarUrl;
  final String? coverImageUrl;
  final bool isVerified;

  final int followerCount;
  final int reelCount;
  final int totalViews;

  final bool isFollowing;

  /// Whether the reader is this creator. Decides whether a follow button is
  /// drawn at all — following yourself is refused by the API, so offering the
  /// control would be offering one that cannot work.
  final bool isMe;

  factory Creator.fromJson(Json json) => Creator(
        id: asString(json['id']),
        displayName: asString(json['displayName']),
        bio: asStringOrNull(json['bio']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        coverImageUrl: asStringOrNull(json['coverImageUrl']),
        isVerified: asBool(json['isVerified']),
        followerCount: asInt(json['followerCount']),
        reelCount: asInt(json['reelCount']),
        totalViews: asInt(json['totalViews']),
        isFollowing: asBool(json['isFollowing']),
        isMe: asBool(json['isMe']),
      );

  Creator copyWith({bool? isFollowing, int? followerCount}) => Creator(
        id: id,
        displayName: displayName,
        bio: bio,
        avatarUrl: avatarUrl,
        coverImageUrl: coverImageUrl,
        isVerified: isVerified,
        followerCount: followerCount ?? this.followerCount,
        reelCount: reelCount,
        totalViews: totalViews,
        isFollowing: isFollowing ?? this.isFollowing,
        isMe: isMe,
      );
}
