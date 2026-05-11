import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../state/auth_state.dart';

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

final authStateProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<AuthState>>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

final signInWithGoogleProvider = FutureProvider<void>((ref) async {
  final googleSignIn = GoogleSignIn(
    clientId: 'your-ios-client-id',
  );

  final account = await googleSignIn.signIn();
  if (account == null) return;

  final authentication = await account.authentication;
  final idToken = authentication.idToken;
  if (idToken == null) throw Exception('No ID token received from Google');

  await ref.read(authStateProvider.notifier).signInWithGoogle(idToken);
});

final signInWithAppleProvider = FutureProvider<void>((ref) async {
  final credential = await SignInWithApple.getAppleIDCredential(
    scopes: [
      AppleIDAuthorizationScopes.email,
      AppleIDAuthorizationScopes.fullName,
    ],
  );

  await ref.read(authStateProvider.notifier).signInWithApple(
        credential.identityToken ?? '',
        credential.userIdentifier ?? '',
      );
});

class AuthNotifier extends StateNotifier<AsyncValue<AuthState>> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(AsyncValue.data(AuthState.initial()));

  Future<void> signInWithGoogle(String idToken) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final result = await _repository.signInWithGoogle(idToken);
      return AuthState(
        isAuthenticated: true,
        isNewUser: result.isNewUser,
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
        isNewUser: result.isNewUser,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
    });
  }

  Future<void> completeOnboarding(String sampradayId) async {
    state = await AsyncValue.guard(() async {
      final result = await _repository.completeOnboarding(sampradayId);
      final prev = state.valueOrNull ?? AuthState.initial();
      return prev.copyWith(
        isNewUser: false,
        user: result.user,
      );
    });
  }

  Future<void> logout() async {
    await _repository.logout();
    state = AsyncValue.data(AuthState.initial());
  }

  Future<void> deleteAccount() async {
    await _repository.deleteAccount();
    state = AsyncValue.data(AuthState.initial());
  }
}
