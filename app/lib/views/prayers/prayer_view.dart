import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/prayer_scripts.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/prayer.dart';
import '../../providers/language_chain_provider.dart';
import '../../providers/prayer_prefs_provider.dart';
import '../../providers/prayer_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/prayers/prayer_header.dart';
import '../../widgets/prayers/prayer_script_bar.dart';
import '../../widgets/prayers/prayer_settings_sheet.dart';
import '../../widgets/prayers/prayer_source_card.dart';
import '../../widgets/prayers/prayer_verse_block.dart';

/// One prayer to read: its verses in the script the reader reads, each with a
/// meaning that opens and closes, and where it comes from.
class PrayerView extends ConsumerStatefulWidget {
  const PrayerView({super.key, required this.id});

  final String id;

  @override
  ConsumerState<PrayerView> createState() => _PrayerViewState();
}

class _PrayerViewState extends ConsumerState<PrayerView> {
  /// The ids of the verses whose meaning is open. Null until the prayer
  /// arrives, when it starts as every verse (if the reader keeps meanings open)
  /// or none.
  Set<String>? _open;

  /// Verses written in a script by rule are remembered for the prayer on show;
  /// a refreshed prayer is a new object and starts afresh.
  Prayer? _rendersFor;
  PrayerRenderer _renderer = PrayerRenderer();

  /// The verses that have a meaning to open.
  static Set<String> _withMeaning(Prayer prayer) => {
        for (final verse in prayer.verses)
          if ((verse.meaning ?? '').trim().isNotEmpty) verse.id,
      };

  void _toggle(String verseId) {
    final open = {...?_open};
    if (!open.remove(verseId)) open.add(verseId);
    setState(() => _open = open);
  }

  /// Every meaning open or closed, remembered as the default for the next
  /// prayer. A single verse opened by hand does not change the default.
  void _setAll(Prayer prayer, {required bool open}) {
    setState(() => _open = open ? _withMeaning(prayer) : <String>{});
    unawaited(ref.read(prayerMeaningsOpenProvider.notifier).set(open));
  }

  Widget _plain(AppLocalizations text, Widget body) => Scaffold(
        appBar: AppBar(title: Text(text.prayersTitle, style: context.texts.headlineSmall)),
        body: body,
      );

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final provider = prayerProvider(widget.id);

    // The switch in the settings sheet sets the default for every verse here too.
    ref.listen(prayerMeaningsOpenProvider, (_, open) {
      final prayer = ref.read(provider).value;
      if (prayer != null) setState(() => _open = open ? _withMeaning(prayer) : <String>{});
    });

    return ref.watch(provider).when(
          loading: () => _plain(text, const AppLoader()),
          error: (error, _) => _plain(
            text,
            AppErrorView(
              failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
              onRetry: () async => ref.refresh(provider.future),
            ),
          ),
          data: (prayer) => _reader(context, text, prayer),
        );
  }

  Widget _reader(BuildContext context, AppLocalizations text, Prayer prayer) {
    final scale = ref.watch(readingFontSizeProvider).scale;
    final showOriginal = ref.watch(prayerShowOriginalProvider);
    final code = resolvePrayerScript(
      prayer,
      saved: ref.watch(prayerScriptProvider),
      chain: ref.watch(readingChainProvider),
    );
    final script = prayer.script(code) ??
        const PrayerScript(code: PrayerScript.originalCode, kind: PrayerScriptKind.original);

    if (!identical(_rendersFor, prayer)) {
      _rendersFor = prayer;
      _renderer = PrayerRenderer();
    }
    final open = _open ??= ref.read(prayerMeaningsOpenProvider) ? _withMeaning(prayer) : <String>{};
    final withMeaning = _withMeaning(prayer);
    final allOpen = withMeaning.isNotEmpty && withMeaning.every(open.contains);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            title: Text(text.prayersTitle, style: context.texts.headlineSmall),
            actions: [
              if (withMeaning.isNotEmpty)
                IconButton(
                  tooltip: allOpen ? text.prayersCollapseAll : text.prayersExpandAll,
                  icon: Icon(allOpen ? Icons.unfold_less_rounded : Icons.unfold_more_rounded),
                  onPressed: () => _setAll(prayer, open: !allOpen),
                ),
              IconButton(
                tooltip: text.readingSettingsTitle,
                icon: const Icon(Icons.text_fields_rounded),
                onPressed: () => showPrayerSettingsSheet(context),
              ),
            ],
          ),
          SliverToBoxAdapter(child: PrayerHeader(prayer: prayer)),
          if (prayer.offersScripts)
            SliverPersistentHeader(
              pinned: true,
              delegate: PrayerScriptBarPin(
                extent: PrayerScriptBar.extentFor(context),
                child: PrayerScriptBar(
                  prayer: prayer,
                  selected: script.code,
                  onSelected: (picked) => unawaited(ref.read(prayerScriptProvider.notifier).set(picked)),
                ),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.only(top: AppSpacing.lg),
            sliver: SliverList.builder(
              itemCount: prayer.verses.length,
              itemBuilder: (context, index) {
                final verse = prayer.verses[index];
                final shown = _renderer.text(verse, script);
                return Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
                  child: PrayerVerseBlock(
                    key: ValueKey(verse.id),
                    number: verse.position > 0 ? verse.position : index + 1,
                    verse: shown,
                    roman: isRomanPrayerText(shown),
                    original: showOriginal && shown != verse.text ? verse.text : null,
                    meaning: verse.meaning,
                    scale: scale,
                    open: open.contains(verse.id),
                    onToggle: () => _toggle(verse.id),
                  ),
                );
              },
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
              child: PrayerSourceCard(prayer: prayer),
            ),
          ),
          SliverToBoxAdapter(child: SizedBox(height: MediaQuery.paddingOf(context).bottom + AppSpacing.xxxl)),
        ],
      ),
    );
  }
}
