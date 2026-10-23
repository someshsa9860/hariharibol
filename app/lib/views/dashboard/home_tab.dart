import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/layout/adaptive.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/home_feed.dart';
import '../../models/verse.dart';
import '../../providers/home_provider.dart';
import '../../providers/profile_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/chat/chat_entry_card.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/motif.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/book_card.dart';
import '../../widgets/dashboard/continue_reading_card.dart';
import '../../widgets/dashboard/growth_label.dart';
import '../../widgets/dashboard/home_header.dart';
import '../../widgets/dashboard/calendar_entry_card.dart';
import '../../widgets/dashboard/etiquette_entry_card.dart';
import '../../widgets/dashboard/home_stats_card.dart';
import '../../widgets/dashboard/mantra_row.dart';
import '../../widgets/dashboard/mood_chips.dart';
import '../../widgets/dashboard/open_chant.dart';
import '../../widgets/dashboard/routine_entry_card.dart';
import '../../widgets/dashboard/sadhana_card.dart';
import '../../widgets/dashboard/verse_hero_card.dart';
import '../../widgets/library/open_book.dart';

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
          // A new reading language builds the feed again; keep the screen up (in
          // the old language, for the moment the new one takes) instead of a spinner.
          skipLoadingOnReload: true,
          loading: () => const AppLoader(),
          error: (error, _) => AppErrorView(
            failure: error is ApiFailure
                ? error
                : ApiFailure(
                    kind: FailureKind.unknown,
                    message: text.errorGeneric,
                  ),
            onRetry: () => ref.read(homeFeedProvider.notifier).refresh(),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () async {
              await ref.read(homeFeedProvider.notifier).refresh();
              ref.invalidate(userSummaryProvider);
            },
            child: _HomeContent(feed: data),
          ),
        ),
      ),
    );
  }
}

class _HomeContent extends ConsumerWidget {
  const _HomeContent({required this.feed});

  final HomeFeed feed;

  /// Straight to the exact chapter last reached, when there is one — a book
  /// with progress always has a chapter number; only a never-opened book
  /// would not, and that case falls back to the book's own page.
  void _openContinueReading(ContinueReading progress) {
    final chapterNumber = progress.chapterNumber;
    AppNavigator.instance.push(
      chapterNumber == null
          ? AppRoutes.bookPath(progress.book.slug)
          : AppRoutes.chapterPath(
              progress.book.slug,
              chapterNumber,
              canto: progress.cantoNumber,
            ),
    );
  }

  /// Null when the verse carries no book/chapter to open — [VerseHeroCard]
  /// only shows its arrow when this is non-null, so a verse with nowhere to
  /// go never looks tappable.
  VoidCallback? _openVerse(Verse verse) {
    final path = verse.readingPath;
    return path == null ? null : () => AppNavigator.instance.push(path);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);
    final daily = feed.slokaOfTheDay;
    final mine = feed.mySloka;
    // The standing preferred mantra lives on the sadhana profile, not the home
    // feed. Read as a value, not `.when`: a slow or failed load just leaves the
    // shortcut as a generic "Chant now" rather than holding the card back.
    final sadhanaToday = ref.watch(sadhanaTodayProvider).value;

    // Built as a list so each section can be handed its position and brought
    // in a beat after the one above it.
    final sections = <Widget>[
      HomeHeader(date: feed.date, user: user),

      if (daily != null)
        VerseHeroCard(
          label: text.homeVerseOfTheDay,
          verse: daily.verse,
          onPhoto: true,
          onTap: _openVerse(daily.verse),
        ),

      if (feed.sadhana != null)
        SadhanaCard(
          summary: feed.sadhana!,
          onTap: () => AppNavigator.instance.go(AppRoutes.sadhana),
          mantraName: sadhanaToday?.chantMantraName,
          onChant: () => openChant(ref, mantraSlug: sadhanaToday?.chantMantraSlug),
        ),

      // Today's tasks sit beside today's practice. The routine is a screen
      // of its own now, so this is its door — and says how the day is going.
      const RoutineEntryCard(),
      const CalendarEntryCard(),
      const EtiquetteEntryCard(),

      // Lifetime totals, right after today's practice — a separate request
      // from the rest of the feed, so it is signed out only when there is a
      // user to have totals at all.
      if (user != null) const HomeStatsCard(),

      // Signed out, there is nothing to answer and nowhere to record it.
      if (user != null) const MoodChips(),

      // Ask Sakha is for people with an account — it has credits to spend.
      if (user != null) const ChatEntryCard(),

      if (mine != null)
        VerseHeroCard(
          label: text.homeSlokaForYou,
          verse: mine.verse,
          reason: growthReason(text, mine),
          motif: Motif.crescent,
          onTap: _openVerse(mine.verse),
        ),

      if (feed.continueReading != null)
        _TitledSection(
          header: SectionHeader(title: text.homeContinueReading),
          child: ContinueReadingCard(
            progress: feed.continueReading!,
            onTap: () => _openContinueReading(feed.continueReading!),
          ),
        ),

      if (feed.books.isNotEmpty)
        _TitledSection(
          header: SectionHeader(
            title: text.homeBooks,
            onViewAll: () => AppNavigator.instance.go(AppRoutes.library),
          ),
          child: _HorizontalRow(
            height: BookCard.rowHeight,
            itemCount: feed.books.length,
            itemBuilder: (context, index) => BookCard(
              book: feed.books[index],
              onTap: () => openBook(ref, feed.books[index].slug),
            ),
          ),
        ),

      if (feed.mantras.isNotEmpty)
        _TitledSection(
          header: SectionHeader(title: text.homeMantras),
          child: MantraRow(
            mantras: feed.mantras,
            onOpen: (mantra) => AppNavigator.instance.push(
              AppRoutes.mantraPath(mantra.slug),
            ),
          ),
        ),
    ];

    // On a phone: one column, each section rising in a beat after the one above.
    // Wide enough for two (a tablet held sideways, a desktop window, an unfolded
    // foldable): the greeting across the top, then the cards in two columns —
    // split at the hinge when the screen has one.
    final layout = AdaptiveLayout.of(context);
    final padding = AppSpacing.page.copyWith(
      left: layout.gutter,
      right: layout.gutter,
      bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
    );

    if (layout.size.isWide || layout.hasVerticalHinge) {
      final rest = sections.skip(1).toList();
      final left = [for (var i = 0; i < rest.length; i += 2) rest[i]];
      final right = [for (var i = 1; i < rest.length; i += 2) rest[i]];
      return SingleChildScrollView(
        // Always scrollable, or pull-to-refresh stops working on a short screen.
        physics: const AlwaysScrollableScrollPhysics(),
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FadeSlideIn(index: 0, child: sections.first),
            const SizedBox(height: AppSpacing.lg),
            TwoPane(
              firstFlex: 1,
              secondFlex: 1,
              gap: AppSpacing.lg,
              divider: false,
              first: _Lane(sections: left, start: 1),
              second: _Lane(sections: right, start: 2),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      // Always scrollable, or pull-to-refresh stops working on a short screen.
      physics: const AlwaysScrollableScrollPhysics(),
      // The nav bar is frosted and the content runs under it, so the last item
      // has to clear it. The shell folds the bar's height into the body's
      // bottom padding, which is why this is read rather than guessed.
      padding: AppSpacing.page.copyWith(
        bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
      ),
      itemCount: sections.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
      itemBuilder: (context, index) =>
          FadeSlideIn(index: index, child: sections[index]),
    );
  }
}

/// One of the two columns of the wide home screen.
class _Lane extends StatelessWidget {
  const _Lane({required this.sections, required this.start});

  final List<Widget> sections;

  /// The first section's position in the entrance, so the two columns stagger
  /// as one list would.
  final int start;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.lg),
          FadeSlideIn(index: start + i * 2, child: sections[i]),
        ],
      ],
    );
  }
}

/// A heading over a row or a card that is not itself a card.
///
/// The cards above stand a regular gap apart; a heading with nothing around it
/// needs a little more room above, or it reads as belonging to the card before
/// it.
class _TitledSection extends StatelessWidget {
  const _TitledSection({required this.header, required this.child});

  final Widget header;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [header, child],
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
