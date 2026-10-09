import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/app_user.dart';
import '../../models/home_feed.dart';
import '../../models/verse.dart';
import '../../providers/home_provider.dart';
import '../../providers/profile_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_image.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/motif.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/book_card.dart';
import '../../widgets/dashboard/continue_reading_card.dart';
import '../../widgets/dashboard/mantra_card.dart';
import '../../widgets/dashboard/mood_chips.dart';
import '../../widgets/dashboard/open_chant.dart';
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
    final profile = ref.watch(sadhanaTodayProvider).value?.profile;

    // Built as a list so each section can be handed its position and brought
    // in a beat after the one above it.
    final sections = <Widget>[
      _Header(date: feed.date, user: user),

      if (daily != null)
        VerseHeroCard(
          label: text.homeVerseOfTheDay,
          verse: daily.verse,
          onTap: _openVerse(daily.verse),
        ),

      if (feed.sadhana != null)
        SadhanaCard(
          summary: feed.sadhana!,
          onTap: () => AppNavigator.instance.go(AppRoutes.sadhana),
          mantraName: profile?.preferredMantraName,
          onChant: () => openChant(ref, mantraSlug: profile?.preferredMantraSlug),
        ),

      // Lifetime totals, right after today's practice — a separate request
      // from the rest of the feed, so it is signed out only when there is a
      // user to have totals at all.
      if (user != null) const _Stats(),

      // Signed out, there is nothing to answer and nowhere to record it.
      if (user != null) const MoodChips(),

      if (mine != null)
        VerseHeroCard(
          label: text.homeSlokaForYou,
          verse: mine.verse,
          reason: mine.reason,
          motif: Motif.crescent,
          onTap: _openVerse(mine.verse),
        ),

      if (feed.continueReading != null)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title: text.homeContinueReading),
            ContinueReadingCard(
              progress: feed.continueReading!,
              onTap: () => _openContinueReading(feed.continueReading!),
            ),
          ],
        ),

      if (feed.books.isNotEmpty)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: text.homeBooks,
              onViewAll: () => AppNavigator.instance.go(AppRoutes.library),
            ),
            _HorizontalRow(
              height: BookCard.rowHeight,
              itemCount: feed.books.length,
              itemBuilder: (context, index) => BookCard(
                book: feed.books[index],
                onTap: () => AppNavigator.instance.push(
                  AppRoutes.bookPath(feed.books[index].slug),
                ),
              ),
            ),
          ],
        ),

      if (feed.mantras.isNotEmpty)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title: text.homeMantras),
            _HorizontalRow(
              height: AppSizes.coverHeight * 0.8,
              itemCount: feed.mantras.length,
              itemBuilder: (context, index) => MantraCard(
                mantra: feed.mantras[index],
                onTap: () => AppNavigator.instance.push(
                  AppRoutes.mantraPath(feed.mantras[index].slug),
                ),
              ),
            ),
          ],
        ),
    ];

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
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xl),
      itemBuilder: (context, index) =>
          FadeSlideIn(index: index, child: sections[index]),
    );
  }
}

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
              Text(_formatted(text, date), style: context.texts.bodySmall),
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
  String _formatted(AppLocalizations text, String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return '';
    try {
      return text.homeDateLine(parsed);
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
        onTap: () => AppNavigator.instance.push(AppRoutes.settings),
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
                  borderRadius: const BorderRadius.all(
                    Radius.circular(AppRadius.pill),
                  ),
                )
              : Center(
                  child: Text(
                    user.initials,
                    style: AppTypography.numeral(
                      context,
                      size: 18,
                    ).copyWith(color: context.colors.onPrimaryContainer),
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

/// Lifetime totals — rounds chanted, days practiced, verses saved and read —
/// as one banded card rather than four boxed tiles.
///
/// A separate request from the rest of the feed, since these are running
/// totals rather than anything today's date changes. Null until they arrive;
/// zeroes are shown rather than a spinner so the card does not jump into place
/// once the count is known.
class _Stats extends ConsumerWidget {
  const _Stats();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final summary = ref.watch(userSummaryProvider).value;

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _StatColumn(
                icon: Icons.radio_button_unchecked_rounded,
                value: '${summary?.totalRounds ?? 0}',
                label: text.profileStatTotalRounds,
              ),
              _StatDivider(),
              _StatColumn(
                icon: Icons.local_fire_department_outlined,
                value: '${summary?.chantingDays ?? 0}',
                label: text.profileStatChantingDays,
              ),
              _StatDivider(),
              _StatColumn(
                icon: Icons.favorite_outline_rounded,
                value: '${summary?.favorites ?? 0}',
                label: text.profileStatVersesSaved,
              ),
              _StatDivider(),
              _StatColumn(
                icon: Icons.auto_stories_outlined,
                value: '${summary?.slokasRead ?? 0}',
                label: text.profileStatSlokasRead,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) {
    return VerticalDivider(
      width: 1,
      thickness: 1,
      color: context.colors.outlineVariant,
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        label: '$label: $value',
        child: ExcludeSemantics(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: AppSizes.iconSm, color: context.colors.primary),
              const SizedBox(height: AppSpacing.xs),
              Text(
                value,
                style: AppTypography.numeral(context, size: 22),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.texts.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
