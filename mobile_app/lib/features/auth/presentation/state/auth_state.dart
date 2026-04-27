import '../../domain/entities/user.dart';

class AuthState {
  final bool isAuthenticated;
  final User? user;
  final String? accessToken;
  final String? refreshToken;

  const AuthState({
    required this.isAuthenticated,
    this.user,
    this.accessToken,
    this.refreshToken,
  });

  factory AuthState.initial() {
    return const AuthState(isAuthenticated: false);
  }

  AuthState copyWith({
    bool? isAuthenticated,
    User? user,
    String? accessToken,
    String? refreshToken,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
    );
  }
}
