import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required String id,
    required String email,
    String? name,
    String? avatarUrl,
    required String languagePreference,
  }) : super(
    id: id,
    email: email,
    name: name,
    avatarUrl: avatarUrl,
    languagePreference: languagePreference,
  );

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      languagePreference: json['languagePreference'] as String? ?? 'en',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'avatarUrl': avatarUrl,
      'languagePreference': languagePreference,
    };
  }
}
