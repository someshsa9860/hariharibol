import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../data/models/in_app_notification_model.dart';
import '../providers/notifications_providers.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(notificationsProvider.notifier).fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsProvider);
    final hasUnread = state.unreadCount > 0;

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.maroon,
        foregroundColor: Colors.white,
        title: const Text(
          'Notifications',
          style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontFamily: 'Playfair Display'),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
              child: const Text(
                'Mark all read',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
        ],
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.saffron))
          : state.notifications.isEmpty
              ? _EmptyState(error: state.error)
              : RefreshIndicator(
                  color: AppColors.saffron,
                  onRefresh: () =>
                      ref.read(notificationsProvider.notifier).fetch(),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
                    itemCount: state.notifications.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 8),
                    itemBuilder: (context, i) => _NotificationCard(
                      notification: state.notifications[i],
                      onTap: () => _onTap(
                          context, state.notifications[i]),
                    ),
                  ),
                ),
    );
  }

  void _onTap(BuildContext context, InAppNotificationModel n) {
    if (!n.isRead) {
      ref.read(notificationsProvider.notifier).markRead(n.id);
    }
    switch (n.type) {
      case 'verse':
        if (n.entityId != null) context.push('/verse/${n.entityId}');
        break;
      case 'verse_of_day':
        context.push('/verse-of-day');
        break;
      case 'mantra':
        if (n.entityId != null) context.push('/mantra/${n.entityId}');
        break;
      default:
        break;
    }
  }
}

// ─── Notification Card ────────────────────────────────────────────────────────

class _NotificationCard extends StatelessWidget {
  final InAppNotificationModel notification;
  final VoidCallback onTap;

  const _NotificationCard(
      {required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: notification.isRead
              ? Colors.white
              : AppColors.saffron.withOpacity(0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: notification.isRead
                ? Colors.transparent
                : AppColors.saffron.withOpacity(0.25),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TypeIcon(type: notification.type),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: notification.isRead
                                ? FontWeight.w500
                                : FontWeight.bold,
                            color: AppColors.textDark,
                          ),
                        ),
                      ),
                      if (!notification.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 6, top: 4),
                          decoration: const BoxDecoration(
                            color: AppColors.saffron,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  if (notification.body != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      notification.body!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textMuted),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    _timeAgo(notification.createdAt),
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}';
  }
}

// ─── Type Icon ────────────────────────────────────────────────────────────────

class _TypeIcon extends StatelessWidget {
  final String type;
  const _TypeIcon({required this.type});

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _iconFor(type);
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: type == 'verse_of_day' || type == 'mantra'
            ? Text('ॐ',
                style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.bold))
            : Icon(icon, color: color, size: 20),
      ),
    );
  }

  (IconData, Color) _iconFor(String type) {
    switch (type) {
      case 'verse':
        return (Icons.menu_book_rounded, AppColors.peacock);
      case 'verse_of_day':
        return (Icons.wb_sunny_rounded, AppColors.saffron);
      case 'mantra':
        return (Icons.self_improvement_rounded, AppColors.maroon);
      case 'announcement':
        return (Icons.campaign_rounded, AppColors.primary);
      default:
        return (Icons.notifications_rounded, AppColors.textMuted);
    }
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String? error;
  const _EmptyState({this.error});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.notifications_none_rounded,
            size: 64,
            color: AppColors.textMuted.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            error ?? 'No notifications yet',
            style: const TextStyle(
                fontSize: 16,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          if (error == null)
            const Text(
              'You\'re all caught up!',
              style:
                  TextStyle(fontSize: 13, color: AppColors.textMuted),
            ),
        ],
      ),
    );
  }
}
