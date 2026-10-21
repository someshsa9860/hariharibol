import '../core/constants/api_paths.dart';
import '../models/chant_group.dart';
import 'api_client.dart';

/// Chanting groups: the REST half. The live room's audio is WebRTC between the
/// phones (`GroupLiveRoom`); these calls only say who is in it and pass the
/// handshake along.
class GroupService {
  GroupService._();

  static final GroupService instance = GroupService._();

  final ApiClient _api = ApiClient.instance;

  Future<GroupList> list() async => GroupList.fromJson((await _api.get(ApiPaths.groups)).json);

  Future<ChantGroup> read(String id) async => ChantGroup.fromJson((await _api.get(ApiPaths.group(id))).json);

  Future<void> create({required String name, String? description}) => _api.post(
        ApiPaths.groups,
        body: {'name': name, if (description != null && description.isNotEmpty) 'description': description},
      );

  Future<void> invite(String id, String email) => _api.post(ApiPaths.groupInvite(id), body: {'email': email});

  Future<void> accept(String id) => _api.post(ApiPaths.groupAccept(id));

  Future<void> decline(String id) => _api.post(ApiPaths.groupDecline(id));

  Future<void> leave(String id) => _api.post(ApiPaths.groupLeave(id));

  /// Only the person who made the group; the server refuses anyone else.
  Future<void> delete(String id) => _api.delete(ApiPaths.group(id));

  /// Removes a member, or takes back an invitation that was not answered.
  Future<void> removeMember(String id, String userId) => _api.delete(ApiPaths.groupMember(id, userId));

  Future<void> setRole(String id, String userId, GroupRole role) => _api.put(
        ApiPaths.groupMemberRole(id, userId),
        body: {'role': role == GroupRole.admin ? 'ADMIN' : 'MEMBER'},
      );

  // The live room.

  Future<RoomEntry> startRoom(String id) async =>
      RoomEntry.fromJson((await _api.post(ApiPaths.groupLive(id, 'start'))).json);

  Future<RoomEntry> joinRoom(String id) async =>
      RoomEntry.fromJson((await _api.post(ApiPaths.groupLive(id, 'join'))).json);

  /// `open` is false once the room has closed; `joined` is false when the
  /// server has already dropped this phone from it.
  Future<({bool open, bool joined})> heartbeat(String id) async {
    final json = (await _api.post(ApiPaths.groupLive(id, 'heartbeat'))).json;
    return (open: json['open'] == true, joined: json['joined'] != false);
  }

  Future<void> leaveRoom(String id) => _api.post(ApiPaths.groupLive(id, 'leave'));

  Future<void> endRoom(String id) => _api.post(ApiPaths.groupLive(id, 'end'));

  Future<void> signal(String id, {required String to, required String kind, required Map<String, dynamic> data}) =>
      _api.post(ApiPaths.groupLive(id, 'signal'), body: {'to': to, 'kind': kind, 'data': data});
}
