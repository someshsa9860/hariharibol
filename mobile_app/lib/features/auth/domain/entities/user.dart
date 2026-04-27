class User {
  final String id;
  final String email;
  final String? name;
  final String? avatarUrl;
  final String languagePreference;

  const User({
    required this.id,
    required this.email,
    this.name,
    this.avatarUrl,
    required this.languagePreference,
  });

  User copyWith({
    String? id,
    String? email,
    String? name,
    String? avatarUrl,
    String? languagePreference,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      languagePreference: languagePreference ?? this.languagePreference,
    );
  }
}
