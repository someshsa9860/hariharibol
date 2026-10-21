import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/share.dart';
import '../../services/share_service.dart';
import '../../widgets/common/peacock_feather_icon.dart';
import '../../widgets/share/make_reel_sheet.dart';
import '../../widgets/share/share_card.dart';
import '../../widgets/share/share_target.dart';

/// The share studio: one sheet for every verse, mantra and reel the app can
/// share. It makes the picture, and it makes the link — the same link scheme
/// the website uses, so what is shared here opens the same page there.
class ShareStudio extends StatefulWidget {
  const ShareStudio({super.key, required this.target});

  final ShareTarget target;

  static Future<void> open(BuildContext context, ShareTarget target) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => ShareStudio(target: target),
    );
  }

  @override
  State<ShareStudio> createState() => _ShareStudioState();
}

class _ShareStudioState extends State<ShareStudio> {
  static const int _maxPictureBytes = 8 * 1024 * 1024;

  final GlobalKey _cardKey = GlobalKey();
  ShareRatio _ratio = ShareRatio.portrait;
  int _theme = 0;
  bool _meaning = true;
  bool _translit = false;
  double _scale = 1;
  ImageProvider? _picture;
  String? _link;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _meaning = (widget.target.meaning ?? '').isNotEmpty;
    _loadLink();
  }

  Future<void> _loadLink() async {
    try {
      final link = await ShareService.instance.link(widget.target.type, widget.target.id);
      if (mounted) setState(() => _link = link);
    } on ApiFailure {
      // The picture can still be shared; the link buttons stay off.
    }
  }

  /// The card as a PNG, at three times its layout size (1080 points wide).
  Future<Uint8List?> _renderPng() async {
    final boundary = _cardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;
    final image = await boundary.toImage(pixelRatio: 3);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data?.buffer.asUint8List();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    final text = AppLocalizations.of(context);
    try {
      await action();
    } catch (_) {
      AppNavigator.instance.showMessage(text.shareFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sharePicture() => _run(() async {
        final bytes = await _renderPng();
        if (bytes == null) throw StateError('no picture');
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/hariharibol-${widget.target.id.replaceAll(RegExp(r'[^A-Za-z0-9.-]'), '-')}.png');
        await file.writeAsBytes(bytes, flush: true);
        // Some apps drop the link when a file is shared, so it rides in the text too.
        await SharePlus.instance.share(ShareParams(
          files: [XFile(file.path, mimeType: 'image/png')],
          text: widget.target.plainText(_link),
        ));
      });

  /// The card, posted as a reel everyone can watch. The sheet asks for music
  /// and does the posting.
  Future<void> _makeReel() async {
    final text = AppLocalizations.of(context);
    final bytes = await _renderPng();
    if (bytes == null || !mounted) return;
    final posted = await MakeReelSheet.open(context, card: bytes, target: widget.target);
    if (posted == true) AppNavigator.instance.showMessage(text.shareReelDone);
  }

  Future<void> _shareText() => _run(() async {
        await SharePlus.instance.share(ShareParams(text: widget.target.plainText(_link)));
      });

  Future<void> _shareLink() => _run(() async {
        final link = _link;
        if (link != null) await SharePlus.instance.share(ShareParams(text: link));
      });

  Future<void> _copyLink() async {
    final link = _link;
    if (link == null) return;
    final text = AppLocalizations.of(context);
    await Clipboard.setData(ClipboardData(text: link));
    AppNavigator.instance.showMessage(text.shareCopied);
  }

  Future<void> _pickPicture() async {
    final text = AppLocalizations.of(context);
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400);
    if (file == null) return;
    if (await file.length() > _maxPictureBytes) {
      AppNavigator.instance.showMessage(text.shareImageTooBig);
      return;
    }
    final bytes = await file.readAsBytes();
    if (mounted) setState(() => _picture = MemoryImage(bytes));
  }

  Future<void> _makePicture() async {
    final bytes = await showModalBottomSheet<Uint8List>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _MakePictureSheet(),
    );
    if (bytes != null && mounted) setState(() => _picture = MemoryImage(bytes));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final theme = shareThemes[_theme];
    final hasMeaning = (widget.target.meaning ?? '').isNotEmpty;
    final hasTranslit = (widget.target.transliteration ?? '').isNotEmpty;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
        children: [
          Text(text.shareTitle, style: context.texts.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 420),
              child: FittedBox(
                child: RepaintBoundary(
                  key: _cardKey,
                  child: ShareCard(
                    target: widget.target,
                    ratio: _ratio,
                    theme: theme,
                    showMeaning: _meaning,
                    showTransliteration: _translit,
                    textScale: _scale,
                    picture: _picture,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            alignment: WrapAlignment.center,
            children: [
              for (final ratio in ShareRatio.values)
                ChoiceChip(
                  label: Text(ratio.label),
                  selected: _ratio == ratio,
                  onSelected: (_) => setState(() => _ratio = ratio),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: shareThemes.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final item = shareThemes[index];
                final selected = index == _theme && _picture == null;
                return Semantics(
                  button: true,
                  selected: selected,
                  label: '${index + 1}',
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _theme = index;
                      _picture = null;
                    }),
                    child: Container(
                      width: 44,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        gradient: item.colors.length > 1 ? LinearGradient(colors: item.colors) : null,
                        color: item.colors.first,
                        border: Border.all(
                          color: selected ? context.colors.primary : context.colors.outlineVariant,
                          width: selected ? 3 : 1,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (hasMeaning)
                FilterChip(label: Text(text.shareShowMeaning), selected: _meaning, onSelected: (v) => setState(() => _meaning = v)),
              if (hasTranslit)
                FilterChip(label: Text(text.shareShowTransliteration), selected: _translit, onSelected: (v) => setState(() => _translit = v)),
              ActionChip(avatar: const Icon(Icons.photo_library_outlined, size: 18), label: Text(text.sharePickPicture), onPressed: _pickPicture),
              ActionChip(avatar: const Icon(Icons.auto_awesome_outlined, size: 18), label: Text(text.shareMakePicture), onPressed: _makePicture),
              if (_picture != null)
                ActionChip(avatar: const Icon(Icons.close_rounded, size: 18), label: Text(text.shareRemovePicture), onPressed: () => setState(() => _picture = null)),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.text_fields_rounded, size: 20),
              Expanded(
                child: Slider(
                  semanticFormatterCallback: (_) => text.shareTextSize,
                  value: _scale,
                  min: 0.7,
                  max: 1.5,
                  onChanged: (v) => setState(() => _scale = double.parse(v.toStringAsFixed(2))),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.icon(
            onPressed: _busy ? null : _sharePicture,
            icon: const Icon(Icons.ios_share_rounded),
            label: Text(text.sharePictureShare),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: _busy ? null : _makeReel,
            icon: const PeacockFeatherIcon(size: 20),
            label: Text(text.shareMakeReel),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              OutlinedButton(onPressed: _busy ? null : _shareText, child: Text(text.shareAsText)),
              OutlinedButton(onPressed: _busy || _link == null ? null : _shareLink, child: Text(text.shareLinkShare)),
              OutlinedButton(onPressed: _link == null ? null : _copyLink, child: Text(text.shareCopyLink)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Asks for a description and makes the picture from the reader's Ask Sakha
/// credit. Pops with the picture's bytes.
class _MakePictureSheet extends StatefulWidget {
  const _MakePictureSheet();

  @override
  State<_MakePictureSheet> createState() => _MakePictureSheetState();
}

enum _Problem { none, credit, failed }

class _MakePictureSheetState extends State<_MakePictureSheet> {
  final TextEditingController _prompt = TextEditingController();
  BackgroundQuote? _quote;
  bool _busy = false;
  _Problem _problem = _Problem.none;

  /// One key per attempt. Pressing the button again after a failure sends the
  /// same key, so the server can never charge for the same picture twice.
  String? _attempt;

  @override
  void initState() {
    super.initState();
    ShareService.instance.backgroundQuote().then((quote) {
      if (mounted) setState(() => _quote = quote);
    }, onError: (Object _) {});
  }

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  Future<void> _make() async {
    _attempt ??= 'a${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}${Random().nextInt(1 << 32).toRadixString(36)}';
    setState(() {
      _busy = true;
      _problem = _Problem.none;
    });
    try {
      final job = await ShareService.instance.makeBackground(requestKey: _attempt!, prompt: _prompt.text.trim());
      if (job.isDone) {
        final bytes = await ShareService.instance.backgroundImage(job.id);
        if (mounted) Navigator.of(context).pop(bytes);
        return;
      }
      setState(() => _problem = _Problem.failed);
    } on ApiFailure catch (failure) {
      setState(() => _problem = failure.code == 'CREDIT_REQUIRED' ? _Problem.credit : _Problem.failed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final quote = _quote;
    final percent = quote?.costPercent;
    final blocked = quote != null && !quote.affordable;

    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(text.shareMakePicture, style: context.texts.titleLarge),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _prompt,
            maxLength: 500,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(labelText: text.sharePicturePrompt),
            onChanged: (_) => setState(() {}),
          ),
          if (quote != null && quote.suggestions.isNotEmpty)
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                for (final suggestion in quote.suggestions.take(3))
                  ActionChip(label: Text(suggestion.split(',').first), onPressed: () => setState(() => _prompt.text = suggestion)),
              ],
            ),
          const SizedBox(height: AppSpacing.sm),
          if (percent != null) Text(text.sharePictureCost(percent), style: context.texts.bodySmall),
          if (_problem == _Problem.credit || blocked) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(text.sharePictureNoCredit, style: context.texts.bodyMedium),
            if (quote?.canUpgrade ?? true)
              TextButton(
                onPressed: () => AppNavigator.instance.push(AppRoutes.plans),
                child: Text(text.settingsPlans),
              ),
          ],
          if (_problem == _Problem.failed) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(text.sharePictureFailed, style: context.texts.bodyMedium),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: _busy || blocked || _prompt.text.trim().length < 8 ? null : _make,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(text.shareMakeIt),
          ),
        ],
      ),
    );
  }
}
