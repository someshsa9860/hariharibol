import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/issue.dart';
import '../../models/sloka.dart';
import '../../providers/home_provider.dart';
import '../../providers/issues_provider.dart';
import '../../services/sloka_service.dart';
import '../common/eyebrow.dart';
import 'mood_sheet.dart';

/// Name what is weighing on you — one struggle or several — and get a verse
/// chosen for each.
///
/// The list is the seeded one, not free text — these are the categories verses
/// are actually mapped to, so anything outside them could not be answered. Its
/// name already comes back from the API in whichever language the person reads
/// in (`GET /api/app/issues` resolves `Issue.name` against the account's own
/// reading language before it ever reaches the app), so nothing here has to
/// know or care whether that is Devanagari, a transliteration, or English.
///
/// Picking is a wrap, not a scroll — every mood is visible without a swipe —
/// and picking is multi-select: nothing is asked until "Show me a verse" is
/// pressed, so choosing three things at once still reads as one action.
///
/// The row renders nothing at all when the request fails or the list is empty.
/// It is one section of a dashboard that has plenty else on it, and an error
/// strip here would be louder than the feature is important.
class MoodChips extends ConsumerStatefulWidget {
  const MoodChips({super.key});

  @override
  ConsumerState<MoodChips> createState() => _MoodChipsState();
}

class _MoodChipsState extends ConsumerState<MoodChips> {
  /// Slugs picked so far, in tap order. The backend keeps one personal sloka
  /// per day and each mood answered overwrites it, so whichever was tapped
  /// last should be the one still sitting there afterwards — tap order has to
  /// survive into the order these are sent.
  final Set<String> _selected = {};
  bool _submitting = false;
  bool _viewing = false;

  void _toggle(String slug) {
    if (_submitting) return;
    setState(() {
      if (!_selected.remove(slug)) _selected.add(slug);
    });
  }

  /// Reopens every vikara answered today, each with the verse it was given —
  /// not just the one behind the chip that was tapped. `/sloka/mood` keeps
  /// only the latest of these on the dashboard's own "for you" card, so this
  /// re-fetch is the only place an earlier pick in the same day is still
  /// reachable once a later one has overwritten it there.
  Future<void> _viewToday() async {
    if (_viewing) return;
    setState(() => _viewing = true);

    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final text = AppLocalizations.of(context);

    try {
      final today = await SlokaService.instance.moodToday();
      if (!mounted) return;
      if (today.isEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(text.errorGeneric)));
        return;
      }
      await showMoodSlokas(
        navigator.context,
        results: [
          // Oldest first, so the order matches how they were originally
          // tapped and answered — `/sloka/mood/today` comes back newest first.
          for (final sloka in today.reversed) (label: sloka.issue?.name ?? '', sloka: sloka),
        ],
      );
    } on ApiFailure {
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(text.errorGeneric)));
      }
    } finally {
      if (mounted) setState(() => _viewing = false);
    }
  }

  Future<void> _submit(List<Issue> issues) async {
    if (_selected.isEmpty || _submitting) return;
    setState(() => _submitting = true);

    // Captured before the first await: the widget can be gone by the time
    // this resolves, and both of these are illegal to reach for after that.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final text = AppLocalizations.of(context);

    // Looked up here rather than trusted from the response: `/sloka/mood`
    // echoes back the plain `Issue.name` column, not the one resolved against
    // a reading language the way the chip's own label already is — carrying
    // the chip's label forward is what keeps the sheet in the same language
    // as the row that opened it.
    final bySlug = {for (final issue in issues) issue.slug: issue};
    final picked = [
      for (final slug in _selected) bySlug[slug],
    ].whereType<Issue>();

    final results = <({String label, PersonalSloka sloka})>[];
    ApiFailure? lastFailure;
    for (final issue in picked) {
      try {
        final sloka = await SlokaService.instance.forMood(issue.slug);
        results.add((label: issue.name, sloka: sloka));
      } on ApiFailure catch (failure) {
        // One struggle nothing has been mapped to yet should not stop the
        // rest from being answered.
        lastFailure = failure;
      }
    }
    if (!mounted) return;

    if (results.isEmpty) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            lastFailure?.statusCode == 404
                ? lastFailure!.message
                : text.errorGeneric,
          ),
        ),
      );
    } else {
      // The personal sloka on the dashboard is the last of these written, so
      // the card behind the sheet would otherwise still show the old verse.
      unawaited(ref.read(homeFeedProvider.notifier).refresh());
      await showMoodSlokas(navigator.context, results: results);
    }

    if (mounted) {
      setState(() {
        _selected.clear();
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final issues = ref.watch(issuesProvider).value ?? const <Issue>[];
    if (issues.isEmpty) return const SizedBox.shrink();

    // Reported today, in whichever session or install did it — this is the
    // backend's own record, cached with the rest of the dashboard, so it
    // still holds after a cold restart rather than resetting with app state.
    final answeredToday = ref.watch(homeFeedProvider).value?.issuesReportedToday.toSet() ?? const <String>{};
    final hasAnsweredToday = answeredToday.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(text.homeMoodPrompt),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final issue in issues)
              _MoodChip(
                issue: issue,
                selected: hasAnsweredToday
                    ? answeredToday.contains(issue.slug)
                    : _selected.contains(issue.slug),
                // Choosing a new vikara is closed off once today's answer is
                // in, but an already-answered one stays tappable — that tap
                // reopens its verse rather than picking it again.
                enabled: hasAnsweredToday
                    ? answeredToday.contains(issue.slug) && !_viewing
                    : !_submitting,
                onTap: () => hasAnsweredToday ? _viewToday() : _toggle(issue.slug),
              ),
          ],
        ),
        AnimatedSize(
          duration: AppDurations.normal,
          curve: Curves.easeOut,
          alignment: AlignmentDirectional.topStart,
          child: hasAnsweredToday
              ? Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        text.homeMoodAnsweredToday,
                        style: context.texts.bodySmall?.copyWith(
                          color: context.colors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      // The chips above reopen these too, but they read as
                      // finished, not tappable — so the way back to the verses
                      // is a control that says what it does.
                      OutlinedButton.icon(
                        onPressed: _viewing ? null : _viewToday,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                        ),
                        icon: _viewing
                            ? SizedBox(
                                width: AppSizes.iconSm,
                                height: AppSizes.iconSm,
                                child: const CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(
                                Icons.menu_book_rounded,
                                size: AppSizes.iconSm,
                              ),
                        label: Text(text.homeMoodViewToday(answeredToday.length)),
                      ),
                    ],
                  ),
                )
              : _selected.isEmpty
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.md),
                      child: FilledButton.icon(
                        onPressed: _submitting ? null : () => _submit(issues),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                        ),
                        icon: _submitting
                            ? SizedBox(
                                width: AppSizes.iconSm,
                                height: AppSizes.iconSm,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: context.colors.onPrimary,
                                ),
                              )
                            : const Icon(
                                Icons.menu_book_rounded,
                                size: AppSizes.iconSm,
                              ),
                        label: Text(text.homeMoodSubmit(_selected.length)),
                      ),
                    ),
        ),
      ],
    );
  }
}

class _MoodChip extends StatelessWidget {
  const _MoodChip({
    required this.issue,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final Issue issue;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // FilterChip only swaps in the theme's `secondaryLabelStyle` for
    // ChoiceChip, so left to itself the label keeps its unselected ink even
    // once the fill turns primary orange underneath it. Set explicitly, this
    // is the one thing selecting a chip actually has to change.
    final labelColor = selected
        ? context.colors.onPrimary
        : context.colors.onSurface;

    return FilterChip(
      selected: selected,
      onSelected: enabled ? (_) => onTap() : null,
      label: Text(issue.name),
      labelStyle: context.texts.labelLarge?.copyWith(color: labelColor),
      avatar: selected
          ? Icon(
              Icons.check_rounded,
              size: AppSizes.iconSm,
              color: context.colors.onPrimary,
            )
          : null,
    );
  }
}
