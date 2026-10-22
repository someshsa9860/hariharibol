import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';

/// The icon and the name the feed gives each kind of event.
abstract final class EventStyle {
  static IconData icon(String type) => switch (type) {
        'error.spike' => Icons.local_fire_department_outlined,
        'error.new' => Icons.bug_report_outlined,
        'health.alert' => Icons.dns_outlined,
        'user.signup' => Icons.person_add_alt_1_outlined,
        'ticket.new' => Icons.confirmation_number_outlined,
        'ticket.reply' => Icons.reply_outlined,
        'feedback.new' => Icons.star_outline,
        'chat.message' => Icons.chat_bubble_outline,
        _ => Icons.notifications_none,
      };

  static String label(AppLocalizations text, String type) => switch (type) {
        'error.spike' => text.typeErrorSpike,
        'error.new' => text.typeErrorNew,
        'health.alert' => text.typeHealth,
        'user.signup' => text.typeSignup,
        'ticket.new' => text.typeTicket,
        'ticket.reply' => text.typeTicketReply,
        'feedback.new' => text.typeFeedback,
        'chat.message' => text.typeChat,
        _ => type,
      };

  /// Event types the settings screen lets the developer leave out of pushes.
  static const List<String> mutable = [
    'error.new',
    'user.signup',
    'ticket.new',
    'ticket.reply',
    'feedback.new',
    'chat.message',
  ];
}
