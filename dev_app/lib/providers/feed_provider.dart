import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/dev_event.dart';
import '../models/dev_summary.dart';
import '../services/dev_service.dart';
import '../core/constants/app_config.dart';
import 'socket_provider.dart';

class FeedState {
  const FeedState({
    this.items = const [],
    this.hasMore = false,
    this.loadingMore = false,
    this.filter = FeedFilter.all,
    this.fresh = 0,
  });

  final List<DevEvent> items;
  final bool hasMore;
  final bool loadingMore;
  final FeedFilter filter;

  /// Events that arrived live since the list was last at the top — the "N new" chip.
  final int fresh;

  List<DevEvent> get visible => filter == FeedFilter.all ? items : items.where(filter.matches).toList();

  FeedState copyWith({List<DevEvent>? items, bool? hasMore, bool? loadingMore, FeedFilter? filter, int? fresh}) {
    return FeedState(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loadingMore: loadingMore ?? this.loadingMore,
      filter: filter ?? this.filter,
      fresh: fresh ?? this.fresh,
    );
  }
}

/// The live feed: the newest page from the server, then every `dev.event` the socket sends put on top.
class FeedNotifier extends AsyncNotifier<FeedState> {
  @override
  Future<FeedState> build() async {
    ref.listen(socketMessagesProvider, (previous, next) {
      final message = next.value;
      if (message != null && message.event == SocketEvents.event) _onLive(DevEvent.fromJson(message.payload));
    });
    final page = await DevService.instance.feed();
    return FeedState(items: page.items, hasMore: page.hasMore);
  }

  void _onLive(DevEvent event) {
    final current = state.value;
    if (current == null || current.items.any((e) => e.id == event.id)) return;
    state = AsyncData(current.copyWith(items: [event, ...current.items], fresh: current.fresh + 1));
  }

  Future<void> refresh() async {
    final page = await DevService.instance.feed();
    final current = state.value ?? const FeedState();
    state = AsyncData(current.copyWith(items: page.items, hasMore: page.hasMore, fresh: 0, loadingMore: false));
  }

  void setFilter(FeedFilter filter) {
    final current = state.value;
    if (current != null) state = AsyncData(current.copyWith(filter: filter));
  }

  void clearFresh() {
    final current = state.value;
    if (current != null && current.fresh > 0) state = AsyncData(current.copyWith(fresh: 0));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore || current.items.isEmpty) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await DevService.instance.feed(before: current.items.last.id);
      final latest = state.value ?? current;
      final seen = latest.items.map((e) => e.id).toSet();
      state = AsyncData(latest.copyWith(
        items: [...latest.items, ...page.items.where((e) => !seen.contains(e.id))],
        hasMore: page.hasMore,
        loadingMore: false,
      ));
    } catch (_) {
      state = AsyncData((state.value ?? current).copyWith(loadingMore: false));
      rethrow;
    }
  }
}

final feedProvider = AsyncNotifierProvider<FeedNotifier, FeedState>(FeedNotifier.new);

/// The home numbers. Re-read, at most every few seconds, when something happens.
class SummaryNotifier extends AsyncNotifier<DevSummary> {
  Timer? _debounce;

  @override
  Future<DevSummary> build() async {
    ref.listen(socketMessagesProvider, (previous, next) {
      if (next.value == null) return;
      _debounce?.cancel();
      _debounce = Timer(const Duration(seconds: 3), () => unawaited(refresh()));
    });
    ref.onDispose(() => _debounce?.cancel());
    return DevService.instance.summary();
  }

  Future<void> refresh() async {
    try {
      state = AsyncData(await DevService.instance.summary());
    } catch (_) {
      // Keep the numbers on screen; the next event tries again.
    }
  }
}

final summaryProvider = AsyncNotifierProvider<SummaryNotifier, DevSummary>(SummaryNotifier.new);
