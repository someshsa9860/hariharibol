class SampradayEntity {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? thumbnailUrl;
  final int followerCount;

  const SampradayEntity({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.thumbnailUrl,
    required this.followerCount,
  });
}
