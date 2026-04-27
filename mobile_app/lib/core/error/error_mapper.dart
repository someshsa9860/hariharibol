import 'package:dio/dio.dart';
import 'failure.dart';
import '../network/api_exceptions.dart';

class ErrorMapper {
  static Failure map(dynamic error) {
    if (error is DioException) {
      return NetworkFailure(error.message ?? 'Network error');
    } else if (error is ApiException) {
      return ServerFailure(error.message);
    } else {
      return ServerFailure('Unknown error');
    }
  }
}