class User {
  final String id;
  final String email;
  final String? name;
  final String? avatarUrl;
  final String languagePreference;
  final bool onboardingCompleted;
  final String? primarySampradayId;

  const User({
    required this.id,
    required this.email,
    this.name,
    this.avatarUrl,
    required this.languagePreference,
    this.onboardingCompleted = false,
    this.primarySampradayId,
  });

  User copyWith({
    String? id,
    String? email,
    String? name,
    String? avatarUrl,
    String? languagePreference,
    bool? onboardingCompleted,
    String? primarySampradayId,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      languagePreference: languagePreference ?? this.languagePreference,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      primarySampradayId: primarySampradayId ?? this.primarySampradayId,
    );
  }
}
