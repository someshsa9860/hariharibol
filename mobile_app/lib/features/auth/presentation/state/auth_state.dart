import '../../domain/entities/user.dart';

class AuthState {
  final bool isAuthenticated;
  final bool isNewUser;
  final User? user;
  final String? accessToken;
  final String? refreshToken;

  const AuthState({
    required this.isAuthenticated,
    this.isNewUser = false,
    this.user,
    this.accessToken,
    this.refreshToken,
  });

  factory AuthState.initial() => const AuthState(isAuthenticated: false);

  bool get needsOnboarding =>
      isAuthenticated && (isNewUser || (user != null && !user!.onboardingCompleted));

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isNewUser,
    User? user,
    String? accessToken,
    String? refreshToken,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isNewUser: isNewUser ?? this.isNewUser,
      user: user ?? this.user,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
    );
  }
}
