import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/paged.dart';
import '../models/support.dart';
import '../services/support_service.dart';

/// The reader's own tickets and feedback, newest activity first.
final supportTicketsProvider = FutureProvider.autoDispose<Paged<SupportTicket>>((ref) {
  return SupportService.instance.tickets();
});

/// One conversation. Reading it marks the reply read, so the list is refreshed after.
final supportTicketProvider = FutureProvider.autoDispose.family<SupportTicket, String>((ref, id) {
  return SupportService.instance.ticket(id);
});
