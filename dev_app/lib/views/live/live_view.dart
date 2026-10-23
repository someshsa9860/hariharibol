import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/time_format.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/dev_event.dart';
import '../../models/json.dart';
import '../../providers/feed_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/live/connection_dot.dart';
import '../../widgets/live/event_style.dart';
import '../../widgets/live/event_tile.dart';
import '../../widgets/live/summary_grid.dart';

/// The home tab: the numbers on top, then the live feed. New events slide in at the top as they happen.
class LiveView extends ConsumerStatefulWidget {
  const LiveView({super.key});

  @override
  ConsumerState<LiveView> createState() => _LiveViewState();
}

class _LiveViewState extends ConsumerState<LiveView> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    final position = _scroll.position;
    if (position.pixels < 80) ref.read(feedProvider.notifier).clearFresh();
    if (position.pixels > position.maxScrollExtent - 400) {
      ref.read(feedProvider.notifier).loadMore().ignore();
    }
  }

  Future<void> _refresh() async {
    await Future.wait([ref.read(feedProvider.notifier).refresh(), ref.read(summaryProvider.notifier).refresh()]);
  }

  void _open(DevEvent event) {
    final canSupport = ref.read(canManageSupportProvider);
    final conversationId = event.conversationId;
    final ticketId = event.ticketId;
    if (event.type == 'chat.message' && conversationId != null) {
      context.push(AppRoutes.chat(conversationId));
    } else if (ticketId != null && canSupport) {
      context.push(AppRoutes.ticket(ticketId));
    } else {
      _showDetails(event);
    }
  }

  void _showDetails(DevEvent event) {
    final text = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.95,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text(event.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            Text('${EventStyle.label(text, event.type)} · ${dateTimeText(locale, event.createdAt)}',
                style: Theme.of(context).textTheme.bodySmall),
            if (event.body != null) ...[
              const SizedBox(height: AppSpacing.md),
              SelectableText(event.body!),
            ],
            if (event.data.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              Text(text.eventDetails, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              SelectableText(_pretty(event.data), style: const TextStyle(fontFamily: 'monospace')),
            ],
          ],
        ),
      ),
    );
  }

  String _pretty(Json data) => data.entries.map((e) => '${e.key}: ${e.value}').join('\n');

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final feed = ref.watch(feedProvider);
    final summary = ref.watch(summaryProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabLive), actions: const [ConnectionDot()]),
      body: feed.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(feedProvider)),
        data: (state) {
          final items = state.visible;
          return Stack(
            children: [
              RefreshIndicator(
                onRefresh: _refresh,
                child: ListView.separated(
                  controller: _scroll,
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: 2 + (items.isEmpty ? 1 : items.length) + (state.loadingMore ? 1 : 0),
                  separatorBuilder: (context, index) => index == 0 ? const SizedBox.shrink() : const Divider(height: 1),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.all(AppSpacing.gutter),
                        child: summary.when(
                          data: (value) => SummaryGrid(summary: value),
                          loading: () => const SizedBox(height: 120, child: Center(child: CircularProgressIndicator())),
                          error: (error, _) => const SizedBox.shrink(),
                        ),
                      );
                    }
                    if (index == 1) return _Filters(selected: state.filter);
                    if (items.isEmpty && index == 2) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                        child: EmptyPanel(icon: Icons.bolt_outlined, message: text.feedEmpty),
                      );
                    }
                    final itemIndex = index - 2;
                    if (itemIndex >= items.length) {
                      return const Padding(padding: EdgeInsets.all(AppSpacing.lg), child: Center(child: CircularProgressIndicator()));
                    }
                    return EventTile(event: items[itemIndex], onTap: () => _open(items[itemIndex]));
                  },
                ),
              ),
              if (state.fresh > 0)
                Positioned(
                  top: AppSpacing.sm,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: ActionChip(
                      avatar: const Icon(Icons.arrow_upward, size: 16),
                      label: Text(text.feedNewEvents(state.fresh)),
                      onPressed: () {
                        _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
                        ref.read(feedProvider.notifier).clearFresh();
                      },
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Filters extends ConsumerWidget {
  const _Filters({required this.selected});

  final FeedFilter selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    String label(FeedFilter filter) => switch (filter) {
          FeedFilter.all => text.filterAll,
          FeedFilter.alerts => text.filterErrors,
          FeedFilter.health => text.filterServer,
          FeedFilter.users => text.filterSignups,
          FeedFilter.support => text.filterTickets,
          FeedFilter.feedback => text.filterFeedback,
          FeedFilter.chats => text.filterChats,
        };
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter, vertical: AppSpacing.xs),
        children: [
          for (final filter in FeedFilter.values)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.sm),
              child: ChoiceChip(
                label: Text(label(filter)),
                selected: selected == filter,
                onSelected: (_) => ref.read(feedProvider.notifier).setFilter(filter),
              ),
            ),
        ],
      ),
    );
  }
}
