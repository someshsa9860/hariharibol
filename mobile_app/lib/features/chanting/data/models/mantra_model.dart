class MantraModel {
  final String id;
  final String name;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;
  final String? significance;
  final String? audioUrl;
  final String? sampradayId;
  final String? sampradayName;
  final String? category;
  final int recommendationCount;

  const MantraModel({
    required this.id,
    required this.name,
    this.sanskrit,
    this.transliteration,
    this.meaning,
    this.significance,
    this.audioUrl,
    this.sampradayId,
    this.sampradayName,
    this.category,
    this.recommendationCount = 0,
  });

  factory MantraModel.fromJson(Map<String, dynamic> json) {
    return MantraModel(
      id: json['id'] as String,
      name: json['nameKey'] as String? ?? json['name'] as String? ?? '',
      sanskrit: json['text'] as String? ?? json['sanskrit'] as String?,
      transliteration: json['transliteration'] as String?,
      meaning: json['meaningKey'] as String? ?? json['meaning'] as String?,
      significance: json['significance'] as String?,
      audioUrl: json['audioUrl'] as String?,
      sampradayId: json['sampradayId'] as String?,
      sampradayName: json['sampradayName'] as String?,
      category: json['category'] as String?,
      recommendationCount: json['recommendationCount'] as int? ?? 0,
    );
  }
}
