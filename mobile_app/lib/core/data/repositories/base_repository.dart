import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/network/api_client.dart';
import 'package:hari_hari_bol/core/error/failure.dart';

abstract class BaseRepository {
  final Dio _dio = ApiClient.createDio();

  Dio get dio => _dio;

  Future<T> handleRequest<T>(
    Future<Response> Function() request,
    T Function(dynamic data) fromJson,
  ) async {
    try {
      final response = await request();
      return fromJson(response.data);
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ServerFailure('Unknown error: $e');
    }
  }

  Failure _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return NetworkFailure('Connection timeout');
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == 401) {
          return AuthFailure('Unauthorized');
        } else if (statusCode == 404) {
          return ServerFailure('Not found');
        } else {
          return ServerFailure('Server error: $statusCode');
        }
      case DioExceptionType.cancel:
        return ServerFailure('Request cancelled');
      default:
        return NetworkFailure('Network error');
    }
  }
}