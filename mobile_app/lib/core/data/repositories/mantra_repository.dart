import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/mantra_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class MantraRepository {
  Future<List<MantraModel>> getMantras({String? sampradayaId, String lang = 'en'});
  Future<MantraModel> getMantraDetail(String id, {String lang = 'en'});
}

class MantraRepositoryImpl extends BaseRepository implements MantraRepository {
  MantraRepositoryImpl();

  @override
  Future<List<MantraModel>> getMantras({String? sampradayaId, String lang = 'en'}) async {
    final queryParams = <String, dynamic>{'lang': lang};
    if (sampradayaId != null) {
      queryParams['sampradaya_id'] = sampradayaId;
    }
    return handleRequest<List<MantraModel>>(
      () => dio.get(Endpoints.mantras, queryParameters: queryParams),
      (data) => (data as List).map((e) => MantraModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<MantraModel> getMantraDetail(String id, {String lang = 'en'}) async {
    return handleRequest<MantraModel>(
      () => dio.get(Endpoints.mantraDetail(id), queryParameters: {'lang': lang}),
      (data) => MantraModel.fromJson(data),
    );
  }
}