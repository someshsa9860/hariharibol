class DiscipleModel {
  final String name;
  final String? imageUrl;
  final String? description;

  const DiscipleModel({
    required this.name,
    this.imageUrl,
    this.description,
  });

  factory DiscipleModel.fromJson(Map<String, dynamic> json) {
    return DiscipleModel(
      name: json['nameKey'] as String? ?? json['name'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      description:
          json['descriptionKey'] as String? ?? json['description'] as String?,
    );
  }
}

class SampradayMantraModel {
  final String id;
  final String name;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;

  const SampradayMantraModel({
    required this.id,
    required this.name,
    this.sanskrit,
    this.transliteration,
    this.meaning,
  });

  factory SampradayMantraModel.fromJson(Map<String, dynamic> json) {
    return SampradayMantraModel(
      id: json['id'] as String? ?? '',
      name: json['nameKey'] as String? ?? json['name'] as String? ?? '',
      sanskrit: json['sanskrit'] as String?,
      transliteration: json['transliteration'] as String?,
      meaning: json['meaningKey'] as String? ?? json['meaning'] as String?,
    );
  }
}

class SampradayDetailModel {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? thumbnailUrl;
  final String? heroImageUrl;
  final int followerCount;
  final String? founder;
  final String? founderImageUrl;
  final String? philosophy;
  final String? primaryDeity;
  final String? foundingRegion;
  final bool isFollowing;
  final List<DiscipleModel> disciples;
  final List<SampradayMantraModel> mantras;

  const SampradayDetailModel({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.thumbnailUrl,
    this.heroImageUrl,
    required this.followerCount,
    this.founder,
    this.founderImageUrl,
    this.philosophy,
    this.primaryDeity,
    this.foundingRegion,
    this.isFollowing = false,
    this.disciples = const [],
    this.mantras = const [],
  });

  factory SampradayDetailModel.fromJson(Map<String, dynamic> json) {
    final disciplesRaw = json['disciples'] as List? ?? [];
    final mantrasRaw = json['mantras'] as List? ?? [];

    return SampradayDetailModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['nameKey'] as String? ?? json['name'] as String? ?? '',
      description:
          json['descriptionKey'] as String? ?? json['description'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      heroImageUrl:
          json['heroImageUrl'] as String? ?? json['thumbnailUrl'] as String?,
      followerCount: json['followerCount'] as int? ?? 0,
      founder:
          json['founderKey'] as String? ?? json['founder'] as String?,
      founderImageUrl: json['founderImageUrl'] as String?,
      philosophy:
          json['philosophyKey'] as String? ?? json['philosophy'] as String?,
      primaryDeity: json['primaryDeityKey'] as String? ??
          json['primaryDeity'] as String?,
      foundingRegion: json['foundingRegionKey'] as String? ??
          json['foundingRegion'] as String?,
      isFollowing: json['isFollowing'] as bool? ?? false,
      disciples: disciplesRaw
          .map((e) => DiscipleModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      mantras: mantrasRaw
          .map((e) => SampradayMantraModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  SampradayDetailModel copyWith({bool? isFollowing, int? followerCount}) {
    return SampradayDetailModel(
      id: id,
      slug: slug,
      name: name,
      description: description,
      thumbnailUrl: thumbnailUrl,
      heroImageUrl: heroImageUrl,
      followerCount: followerCount ?? this.followerCount,
      founder: founder,
      founderImageUrl: founderImageUrl,
      philosophy: philosophy,
      primaryDeity: primaryDeity,
      foundingRegion: foundingRegion,
      isFollowing: isFollowing ?? this.isFollowing,
      disciples: disciples,
      mantras: mantras,
    );
  }
}
