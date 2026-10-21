import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel.dart';
import '../../providers/reel_provider.dart';
import '../../services/tracking_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/reels/reel_comments_sheet.dart';
import '../../widgets/reels/reel_page.dart';
import '../../widgets/reels/reel_report_sheet.dart';
import 'reel_actions.dart';

/// The book's reels in reading order, from one verse on — what the peacock
/// feather on the reading page opens. Each verse is a reel the app draws
/// itself; one that finishes hands over to the next verse, and the next page
/// is fetched a few reels before the end.
class BookReelsView extends ConsumerStatefulWidget {
  const BookReelsView({super.key, required this.verseId});

  /// The dotted verse id (`1.2.47`) the run starts at.
  final String verseId;

  @override
  ConsumerState<BookReelsView> createState() => _BookReelsViewState();
}

class _BookReelsViewState extends ConsumerState<BookReelsView>
    with WidgetsBindingObserver, ReelActions<BookReelsView> {
  static const int _prefetch = 3;

  final PageController _pages = PageController();
  late final BookReelsLoader _loader = BookReelsLoader(widget.verseId);

  List<Reel>? _reels;
  Object? _error;
  int _index = 0;
  bool _muted = true;
  bool _suspended = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    TrackingService.instance.log('reels_book_open', parameters: {'verse_id': widget.verseId});
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final items = await _loader.next();
      if (mounted) setState(() => _reels = [...?_reels, ...items]);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final suspended = state != AppLifecycleState.resumed;
    if (suspended == _suspended) return;
    setState(() => _suspended = suspended);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pages.dispose();
    super.dispose();
  }

  Future<void> _more() async {
    final reels = _reels;
    if (reels == null || _index < reels.length - _prefetch) return;
    try {
      final items = await _loader.next();
      if (!mounted || items.isEmpty) return;
      final seen = reels.map((reel) => reel.id).toSet();
      setState(() => _reels = [...?_reels, ...items.where((reel) => !seen.contains(reel.id))]);
    } catch (_) {
      // The next swipe tries again; a missed page is not worth interrupting a reel for.
    }
  }

  void _onPageChanged(int index) {
    setState(() => _index = index);
    _more();
    final reels = _reels;
    if (reels != null && index < reels.length) {
      TrackingService.instance.log('reel_view', parameters: {'reel_id': reels[index].id});
    }
  }

  void _advance(int index) {
    final count = _reels?.length ?? 0;
    if (!mounted || index != _index || index + 1 >= count || !_pages.hasClients) return;
    _pages.nextPage(duration: AppDurations.slow, curve: Curves.easeOutCubic);
  }

  @override
  Reel? reelById(String id) {
    final found = _reels?.where((reel) => reel.id == id);
    return (found == null || found.isEmpty) ? null : found.first;
  }

  @override
  void putReel(Reel updated) {
    final current = _reels;
    if (current == null) return;
    setState(() => _reels = [for (final reel in current) if (reel.id == updated.id) updated else reel]);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final reels = _reels;

    Widget body;
    if (reels == null && _error == null) {
      body = const AppLoader();
    } else if (reels == null) {
      body = AppErrorView(
        failure: _error is ApiFailure
            ? _error as ApiFailure
            : ApiFailure(kind: FailureKind.unknown, message: text.reelsFailed),
        onRetry: _load,
      );
    } else if (reels.isEmpty) {
      body = Center(child: EmptyState(message: text.reelsEmptyBody, icon: Icons.smart_display_outlined));
    } else {
      body = PageView.builder(
        controller: _pages,
        scrollDirection: Axis.vertical,
        onPageChanged: _onPageChanged,
        itemCount: reels.length,
        itemBuilder: (context, index) {
          final reel = reels[index];
          return ReelPage(
            key: ValueKey(reel.id),
            reel: reel,
            isActive: index == _index && !_suspended,
            isMuted: _muted,
            onProgress: (watched, duration) => reportWatch(reel, watched, duration),
            onEnded: () => _advance(index),
            onLike: () => toggleLike(reel),
            onSave: () => toggleSave(reel),
            onFollow: () => toggleFollow(reel),
            onComment: () => ReelCommentsSheet.show(context, reel.id),
            onShare: () => shareReel(reel),
            onMore: () => ReelReportSheet.showForReel(context, reel.id),
            onCreatorTap: () => AppNavigator.instance.push(AppRoutes.creatorPath(reel.creator.id)),
            onToggleMute: () => setState(() => _muted = !_muted),
          );
        },
      );
    }

    return Scaffold(
      backgroundColor: AppColors.reelGround,
      extendBodyBehindAppBar: true,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Stack(
          children: [
            body,
            // Under the story bar of a book reel, so it sits low enough not to cover it.
            Positioned(
              top: AppSpacing.lg + AppSpacing.sm,
              left: AppSpacing.sm,
              child: SafeArea(
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: AppColors.reelInk),
                  tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                  onPressed: () => AppNavigator.instance.pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
