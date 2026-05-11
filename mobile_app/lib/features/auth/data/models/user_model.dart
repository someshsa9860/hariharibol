import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required String id,
    required String email,
    String? name,
    String? avatarUrl,
    required String languagePreference,
    bool onboardingCompleted = false,
    String? primarySampradayId,
  }) : super(
          id: id,
          email: email,
          name: name,
          avatarUrl: avatarUrl,
          languagePreference: languagePreference,
          onboardingCompleted: onboardingCompleted,
          primarySampradayId: primarySampradayId,
        );

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      languagePreference: json['languagePreference'] as String? ?? 'en',
      onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
      primarySampradayId: json['primarySampradayId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'avatarUrl': avatarUrl,
      'languagePreference': languagePreference,
      'onboardingCompleted': onboardingCompleted,
      'primarySampradayId': primarySampradayId,
    };
  }
}
