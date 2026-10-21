import 'json.dart';

/// Who may do what in a group. The OWNER made it and is the only one who can
/// delete it; an ADMIN can invite, remove members and make other admins.
enum GroupRole {
  owner,
  admin,
  member;

  static GroupRole parse(dynamic value) => switch (asString(value)) {
        'OWNER' => owner,
        'ADMIN' => admin,
        _ => member,
      };

  bool get isAdmin => this != member;
}

/// A person in a group or its room — never more than the API shows a member.
class GroupPerson {
  const GroupPerson({required this.id, required this.name, this.avatarUrl});

  final String id;
  final String name;
  final String? avatarUrl;

  factory GroupPerson.fromJson(Json json) => GroupPerson(
        id: asString(json['id']),
        name: asString(json['name']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
      );
}

class GroupMember extends GroupPerson {
  const GroupMember({
    required super.id,
    required super.name,
    super.avatarUrl,
    required this.role,
    required this.isInvited,
  });

  final GroupRole role;

  /// Asked, and has not answered yet. Only admins are sent these.
  final bool isInvited;

  factory GroupMember.fromJson(Json json) => GroupMember(
        id: asString(json['id']),
        name: asString(json['name']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        role: GroupRole.parse(json['role']),
        isInvited: asString(json['status']) == 'INVITED',
      );
}

/// The room, while someone is chanting in it.
class LiveRoomState {
  const LiveRoomState({required this.sessionId, required this.participants});

  final String sessionId;
  final List<GroupPerson> participants;

  factory LiveRoomState.fromJson(Json json) => LiveRoomState(
        sessionId: asString(json['sessionId']),
        participants: asList(json['participants'], GroupPerson.fromJson),
      );
}

class ChantGroup {
  const ChantGroup({
    required this.id,
    required this.name,
    required this.myRole,
    required this.memberCount,
    this.description,
    this.mantraName,
    this.live,
    this.members = const [],
  });

  final String id;
  final String name;
  final String? description;
  final String? mantraName;
  final GroupRole myRole;
  final int memberCount;
  final LiveRoomState? live;

  /// Filled on the group's own screen, not in the list.
  final List<GroupMember> members;

  factory ChantGroup.fromJson(Json json) {
    final live = asJson(json['live']);
    return ChantGroup(
      id: asString(json['id']),
      name: asString(json['name']),
      description: asStringOrNull(json['description']),
      mantraName: asStringOrNull(asJson(json['mantra'])?['name']),
      myRole: GroupRole.parse(json['myRole']),
      memberCount: asInt(json['memberCount']),
      live: live == null ? null : LiveRoomState.fromJson(live),
      members: asList(json['members'], GroupMember.fromJson),
    );
  }
}

class GroupInvitation {
  const GroupInvitation({required this.groupId, required this.name, this.invitedBy});

  final String groupId;
  final String name;
  final String? invitedBy;

  factory GroupInvitation.fromJson(Json json) => GroupInvitation(
        groupId: asString(json['groupId']),
        name: asString(json['name']),
        invitedBy: asStringOrNull(asJson(json['invitedBy'])?['name']),
      );
}

class GroupList {
  const GroupList({required this.groups, required this.invitations});

  final List<ChantGroup> groups;
  final List<GroupInvitation> invitations;

  factory GroupList.fromJson(Json json) => GroupList(
        groups: asList(json['groups'], ChantGroup.fromJson),
        invitations: asList(json['invitations'], GroupInvitation.fromJson),
      );
}

/// What entering the room returns: how to reach the others, and who is there.
class RoomEntry {
  const RoomEntry({required this.iceServers, required this.participants});

  /// Passed to WebRTC as they are: `{urls, username?, credential?}`.
  final List<Map<String, dynamic>> iceServers;
  final List<GroupPerson> participants;

  factory RoomEntry.fromJson(Json json) => RoomEntry(
        iceServers: asList(json['iceServers'], (item) => item),
        participants: asList(json['participants'], GroupPerson.fromJson),
      );
}
