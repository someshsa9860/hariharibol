import '../../config/endpoints.dart';
import '../models/verse_model.dart';
import 'base_repository.dart';

abstract class VerseRepository {
  Future<VerseModel> getVerseOfDay();
  Future<VerseModel> getVerse(String id);
  Future<List<VerseModel>> getVersesByCategory(String category);
  Future<List<VerseModel>> getRandomVerses(int count);
}

class VerseRepositoryImpl extends BaseRepository implements VerseRepository {
  @override
  Future<VerseModel> getVerseOfDay() async {
    return handleRequest(
      () => dio.get(Endpoints.verseOfDay),
      (data) => VerseModel.fromJson(data),
    );
  }

  @override
  Future<VerseModel> getVerse(String id) async {
    return handleRequest(
      () => dio.get(Endpoints.buildUrl(Endpoints.verseDetail, {'id': id})),
      (data) => VerseModel.fromJson(data),
    );
  }

  @override
  Future<List<VerseModel>> getVersesByCategory(String category) async {
    return handleRequest(
      () => dio.get('${Endpoints.verses}?category=$category'),
      (data) => (data as List).map((e) => VerseModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<List<VerseModel>> getRandomVerses(int count) async {
    return handleRequest(
      () => dio.get('${Endpoints.randomVerse}?count=$count'),
      (data) => (data as List).map((e) => VerseModel.fromJson(e)).toList(),
    );
  }
}