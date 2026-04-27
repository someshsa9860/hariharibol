import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/sampradaya_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class SampradayaRepository {
  Future<List<SampradayaModel>> getSampradayas({String lang = 'en'});
  Future<SampradayaModel> getSampradayaDetail(String slug, {String lang = 'en'});
  Future<List<dynamic>> getSampradayaMantras(String id, {String lang = 'en'});
  Future<void> followSampradaya(String id);
  Future<void> unfollowSampradaya(String id);
  Future<List<SampradayaModel>> getFollowedSampradayas();
}

class SampradayaRepositoryImpl extends BaseRepository implements SampradayaRepository {
  SampradayaRepositoryImpl();

  @override
  Future<List<SampradayaModel>> getSampradayas({String lang = 'en'}) async {
    return handleRequest<List<SampradayaModel>>(
      () => dio.get(Endpoints.sampradayas, queryParameters: {'lang': lang}),
      (data) => (data as List).map((e) => SampradayaModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<SampradayaModel> getSampradayaDetail(String slug, {String lang = 'en'}) async {
    return handleRequest<SampradayaModel>(
      () => dio.get(Endpoints.sampradayaDetail(slug), queryParameters: {'lang': lang}),
      (data) => SampradayaModel.fromJson(data),
    );
  }

  @override
  Future<List<dynamic>> getSampradayaMantras(String id, {String lang = 'en'}) async {
    return handleRequest<List<dynamic>>(
      () => dio.get(Endpoints.sampradayaMantras(id), queryParameters: {'lang': lang}),
      (data) => data as List<dynamic>,
    );
  }

  @override
  Future<void> followSampradaya(String id) async {
    return handleRequest<void>(
      () => dio.post(Endpoints.followSampradaya(id)),
      (_) {},
    );
  }

  @override
  Future<void> unfollowSampradaya(String id) async {
    return handleRequest<void>(
      () => dio.delete(Endpoints.unfollowSampradaya(id)),
      (_) {},
    );
  }

  @override
  Future<List<SampradayaModel>> getFollowedSampradayas() async {
    return handleRequest<List<SampradayaModel>>(
      () => dio.get(Endpoints.followedSampradayas),
      (data) => (data as List).map((e) => SampradayaModel.fromJson(e)).toList(),
    );
  }
}