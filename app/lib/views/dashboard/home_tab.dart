import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/app_user.dart';
import '../../models/home_feed.dart';
import '../../providers/home_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_image.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/motif.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/book_card.dart';
import '../../widgets/dashboard/continue_reading_card.dart';
import '../../widgets/dashboard/mantra_card.dart';
import '../../widgets/dashboard/mood_chips.dart';
import '../../widgets/dashboard/sadhana_card.dart';
import '../../widgets/dashboard/verse_hero_card.dart';

/// The dashboard.
///
/// One request fills the whole screen — `/api/app/home` assembles it server
/// side rather than making the app fire six calls and wait on all of them at
/// the moment a person is staring at a spinner.
///
/// There is no app bar. The greeting is the heading, and it scrolls away with
/// everything else, so the verse gets the top of the screen instead of a title
/// repeating the name of the app someone just opened.
class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(homeFeedProvider);
    final text = AppLocalizations.of(context);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: feed.when(
          loading: () => const AppLoader(),
          error: (error, _) => AppErrorView(
            failure: error is ApiFailure
                ? error
                : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
            onRetry: () => ref.read(homeFeedProvider.notifier).refresh(),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () => ref.read(homeFeedProvider.notifier).refresh(),
            child: _HomeContent(feed: data),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => AppNavigator.instance.go(AppRoutes.sadhana),
        tooltip: text.tabSadhana,
        shape: const CircleBorder(),
        child: const Icon(Icons.radio_button_unchecked_rounded),
      ),
    );
  }
}

class _HomeContent extends ConsumerWidget {
  const _HomeContent({required this.feed});

  final HomeFeed feed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);
    final daily = feed.slokaOfTheDay;
    final mine = feed.mySloka;

    return ListView(
      // Always scrollable, or pull-to-refresh stops working on a short screen.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.page.copyWith(bottom: AppSpacing.xxxl + AppSizes.buttonHeight),
      children: [
        _Header(date: feed.date, user: user),
        const SizedBox(height: AppSpacing.xl),

        if (daily != null) ...[
          VerseHeroCard(
            label: text.homeVerseOfTheDay,
            verse: daily.verse,
          ),
          const SizedBox(height: AppSpacing.xl),
        ],

        if (feed.sadhana != null) ...[
          SadhanaCard(
            summary: feed.sadhana!,
            onTap: () => AppNavigator.instance.go(AppRoutes.sadhana),
          ),
          const SizedBox(height: AppSpacing.xl),
        ],

        // Signed out, there is nothing to answer and nowhere to record it.
        if (user != null) ...[
          const MoodChips(),
          const SizedBox(height: AppSpacing.xl),
        ],

        if (mine != null) ...[
          VerseHeroCard(
            label: text.homeSlokaForYou,
            verse: mine.verse,
            reason: mine.reason,
            motif: Motif.crescent,
          ),
          const SizedBox(height: AppSpacing.xl),
        ],

        if (feed.continueReading != null) ...[
          SectionHeader(title: text.homeContinueReading),
          ContinueReadingCard(progress: feed.continueReading!),
          const SizedBox(height: AppSpacing.xl),
        ],

        if (feed.books.isNotEmpty) ...[
          SectionHeader(
            title: text.homeBooks,
            onViewAll: () => AppNavigator.instance.go(AppRoutes.library),
          ),
          _HorizontalRow(
            height: AppSizes.coverHeight + AppSpacing.xxl,
            itemCount: feed.books.length,
            itemBuilder: (context, index) => BookCard(book: feed.books[index]),
          ),
          const SizedBox(height: AppSpacing.xl),
        ],

        if (feed.mantras.isNotEmpty) ...[
          SectionHeader(title: text.homeMantras),
          _HorizontalRow(
            height: AppSizes.coverHeight * 0.8,
            itemCount: feed.mantras.length,
            itemBuilder: (context, index) => MantraCard(mantra: feed.mantras[index]),
          ),
        ],
      ],
    );
  }
}

/// The date, the greeting and the way into the profile.
class _Header extends StatelessWidget {
  const _Header({required this.date, this.user});

  /// The user's own local date as the server worked it out, not the device
  /// clock — a traveller should not skip a day.
  final String date;
  final AppUser? user;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final name = user?.displayName;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_formatted(date), style: context.texts.bodySmall),
              const SizedBox(height: AppSpacing.xs),
              Text(
                name == null ? text.homeGreeting : text.homeGreetingNamed(name),
                style: context.texts.headlineMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (user != null) ...[
          const SizedBox(width: AppSpacing.md),
          _Avatar(user: user!),
        ],
      ],
    );
  }

  /// "Saturday · 27 April". Falls back to nothing rather than to a raw
  /// `2026-04-27`, which would read as a bug on the first line of the screen.
  String _formatted(String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return '';
    try {
      return DateFormat('EEEE · d MMMM').format(parsed);
    } catch (_) {
      return '';
    }
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final url = user.avatarUrl;

    return Semantics(
      button: true,
      label: user.displayName,
      child: GestureDetector(
        onTap: () => AppNavigator.instance.go(AppRoutes.profile),
        child: Container(
          width: AppSizes.avatarMd,
          height: AppSizes.avatarMd,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: context.colors.primaryContainer,
            // Most avatars come back on a white ground, which is invisible
            // against paper — the ring is what makes it read as a circle.
            border: Border.all(color: context.colors.outlineVariant),
          ),
          clipBehavior: Clip.antiAlias,
          child: url != null && url.isNotEmpty
              ? AppImage(
                  url: url,
                  cacheKey: 'avatar-${user.id}',
                  width: AppSizes.avatarMd,
                  height: AppSizes.avatarMd,
                  borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
                )
              : Center(
                  child: Text(
                    user.initials,
                    style: AppTypography.numeral(context, size: 18).copyWith(
                      color: context.colors.onPrimaryContainer,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

/// The scrolling row every section on this screen uses.
class _HorizontalRow extends StatelessWidget {
  const _HorizontalRow({
    required this.height,
    required this.itemCount,
    required this.itemBuilder,
  });

  final double height;
  final int itemCount;
  final Widget Function(BuildContext, int) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: itemCount,
        clipBehavior: Clip.none,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: itemBuilder,
      ),
    );
  }
}
