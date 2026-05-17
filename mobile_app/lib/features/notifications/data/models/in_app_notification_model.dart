class InAppNotificationModel {
  final String id;
  final String title;
  final String? body;
  final String type;
  final bool isRead;
  final String? entityId;
  final DateTime createdAt;

  const InAppNotificationModel({
    required this.id,
    required this.title,
    this.body,
    required this.type,
    required this.isRead,
    this.entityId,
    required this.createdAt,
  });

  factory InAppNotificationModel.fromJson(Map<String, dynamic> json) {
    return InAppNotificationModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? json['message'] as String?,
      type: json['type'] as String? ?? 'system',
      isRead: json['isRead'] as bool? ?? json['read'] as bool? ?? false,
      entityId: json['entityId'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  InAppNotificationModel copyWith({bool? isRead}) {
    return InAppNotificationModel(
      id: id,
      title: title,
      body: body,
      type: type,
      isRead: isRead ?? this.isRead,
      entityId: entityId,
      createdAt: createdAt,
    );
  }
}
