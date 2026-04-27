import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../state/auth_state.dart';

// Providers for dependencies
final dioProvider = Provider((ref) => ApiClient.createDio());
final secureStorageProvider = Provider((ref) => const FlutterSecureStorage());

final authRemoteDataSourceProvider = Provider((ref) {
  return AuthRemoteDataSource(ref.watch(dioProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    ref.watch(authRemoteDataSourceProvider),
    ref.watch(secureStorageProvider),
  );
});

// Auth state provider
final authStateProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<AuthState>>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

// Sign in with Google provider
final signInWithGoogleProvider = FutureProvider<void>((ref) async {
  final googleSignIn = GoogleSignIn(
    clientID: 'your-ios-client-id', // Configure this from Firebase
  );

  try {
    final account = await googleSignIn.signIn();
    if (account == null) return;

    final authentication = await account.authentication;
    final idToken = authentication.idToken;

    if (idToken == null) {
      throw Exception('No ID token received from Google');
    }

    final notifier = ref.read(authStateProvider.notifier);
    await notifier.signInWithGoogle(idToken);
  } catch (e) {
    rethrow;
  }
});

// Sign in with Apple provider
final signInWithAppleProvider = FutureProvider<void>((ref) async {
  try {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );

    final notifier = ref.read(authStateProvider.notifier);
    await notifier.signInWithApple(
      credential.identityToken ?? '',
      credential.userIdentifier ?? '',
    );
  } catch (e) {
    rethrow;
  }
});

class AuthNotifier extends StateNotifier<AsyncValue<AuthState>> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AsyncValue.data(AuthState.initial()));

  Future<void> signInWithGoogle(String idToken) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final result = await _repository.signInWithGoogle(idToken);
      return AuthState(
        isAuthenticated: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
    });
  }

  Future<void> signInWithApple(String identityToken, String userIdentifier) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final result = await _repository.signInWithApple(identityToken, userIdentifier);
      return AuthState(
        isAuthenticated: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
    });
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AsyncValue.data(AuthState.initial());
  }

  Future<void> deleteAccount() async {
    await _repository.deleteAccount();
    state = const AsyncValue.data(AuthState.initial());
  }
}
