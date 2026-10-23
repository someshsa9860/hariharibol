import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/ticket.dart';
import '../services/dev_service.dart';

/// Which tickets the list shows.
enum TicketFilter {
  open('OPEN', 'TICKET'),
  inProgress('IN_PROGRESS', 'TICKET'),
  resolved('RESOLVED', 'TICKET'),
  feedback(null, 'FEEDBACK');

  const TicketFilter(this.status, this.kind);

  final String? status;
  final String kind;
}

class TicketListState {
  const TicketListState({this.items = const [], this.page = 1, this.hasMore = false});

  final List<Ticket> items;
  final int page;
  final bool hasMore;
}

class TicketsNotifier extends AsyncNotifier<TicketListState> {
  TicketsNotifier(this._filter);

  final TicketFilter _filter;

  @override
  Future<TicketListState> build() async {
    final page = await DevService.instance.tickets(status: _filter.status, kind: _filter.kind);
    return TicketListState(items: page.items, hasMore: page.hasMore);
  }

  Future<void> refresh() async {
    final page = await DevService.instance.tickets(status: _filter.status, kind: _filter.kind);
    state = AsyncData(TicketListState(items: page.items, hasMore: page.hasMore));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore) return;
    final page = await DevService.instance.tickets(page: current.page + 1, status: _filter.status, kind: _filter.kind);
    final seen = current.items.map((t) => t.id).toSet();
    state = AsyncData(TicketListState(
      items: [...current.items, ...page.items.where((t) => !seen.contains(t.id))],
      page: current.page + 1,
      hasMore: page.hasMore,
    ));
  }
}

final ticketsProvider =
    AsyncNotifierProvider.family.autoDispose<TicketsNotifier, TicketListState, TicketFilter>(TicketsNotifier.new);

class TicketDetailNotifier extends AsyncNotifier<TicketDetail> {
  TicketDetailNotifier(this._id);

  final String _id;

  @override
  Future<TicketDetail> build() => DevService.instance.ticket(_id);

  Future<void> reply(String body) async {
    await DevService.instance.replyToTicket(_id, body);
    state = AsyncData(await DevService.instance.ticket(_id));
    ref.invalidate(ticketsProvider);
  }

  Future<void> setStatus(String status) async {
    await DevService.instance.setTicketStatus(_id, status);
    state = AsyncData(await DevService.instance.ticket(_id));
    ref.invalidate(ticketsProvider);
  }
}

final ticketDetailProvider =
    AsyncNotifierProvider.family.autoDispose<TicketDetailNotifier, TicketDetail, String>(TicketDetailNotifier.new);
