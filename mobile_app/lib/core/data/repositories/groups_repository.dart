import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/groups_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class GroupsRepository {
  Future<List<GroupModel>> getMyGroups();
  Future<GroupModel> getGroupDetail(String id, {String lang = 'en'});
  Future<List<MessageModel>> getGroupMessages(String id, {String? before, int limit = 50});
  Future<MessageModel> sendMessage(String groupId, String content);
  Future<void> joinGroup(String id);
  Future<void> leaveGroup(String id);
  Future<void> reportMessage(String groupId, String messageId);
}

class GroupsRepositoryImpl extends BaseRepository implements GroupsRepository {
  GroupsRepositoryImpl();

  @override
  Future<List<GroupModel>> getMyGroups() async {
    return handleRequest<List<GroupModel>>(
      () => dio.get(Endpoints.myGroups),
      (data) => (data as List).map((e) => GroupModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<GroupModel> getGroupDetail(String id, {String lang = 'en'}) async {
    return handleRequest<GroupModel>(
      () => dio.get(Endpoints.groupDetail(id), queryParameters: {'lang': lang}),
      (data) => GroupModel.fromJson(data),
    );
  }

  @override
  Future<List<MessageModel>> getGroupMessages(String id, {String? before, int limit = 50}) async {
    final queryParams = <String, dynamic>{'limit': limit};
    if (before != null) queryParams['before'] = before;
    return handleRequest<List<MessageModel>>(
      () => dio.get(Endpoints.groupMessages(id), queryParameters: queryParams),
      (data) => (data as List).map((e) => MessageModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<MessageModel> sendMessage(String groupId, String content) async {
    return handleRequest<MessageModel>(
      () => dio.post(Endpoints.sendMessage(groupId), data: {'content': content}),
      (data) => MessageModel.fromJson(data),
    );
  }

  @override
  Future<void> joinGroup(String id) async {
    return handleRequest<void>(
      () => dio.post(Endpoints.joinGroup(id)),
      (_) {},
    );
  }

  @override
  Future<void> leaveGroup(String id) async {
    return handleRequest<void>(
      () => dio.post(Endpoints.leaveGroup(id)),
      (_) {},
    );
  }

  @override
  Future<void> reportMessage(String groupId, String messageId) async {
    return handleRequest<void>(
      () => dio.post(Endpoints.reportMessage(groupId, messageId)),
      (_) {},
    );
  }
}