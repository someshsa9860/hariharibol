import 'dart:async';
import 'dart:io';
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
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/share.dart';
import '../../services/share_service.dart';
import '../../widgets/share/share_card.dart';

/// Share studio: a verse, mantra or reel made into a picture and a link. One screen for every entry point.
///
/// The card is drawn by [ShareCard] and captured from the same widget the reader is looking at, so the preview and
/// the exported picture cannot differ. The link comes from the server (one random code per target); the picture is
/// built on the phone and never uploaded.
class ShareStudioView extends StatefulWidget {
  const ShareStudioView({super.key, required this.args});

  final ShareStudioArgs args;

  @override
  State<ShareStudioView> createState() => _ShareStudioViewState();
}

enum _Tab { gradients, colours, picture, ai }

class _ShareStudioViewState extends State<ShareStudioView> {
  static const int _maxPictureBytes = 8 * 1024 * 1024;

  final GlobalKey _cardKey = GlobalKey();
  final TextEditingController _prompt = TextEditingController(
    text: 'A peaceful golden sunrise behind an ancient Indian temple, warm saffron and gold tones',
  );
  ShareDesign _design = const ShareDesign();
  _Tab _tab = _Tab.gradients;
  ShareLink? _link;
  bool _busy = false;

  // AI background state. [_requestId] is reused when retrying a failure, so a retry is never charged twice.
  BackgroundQuote? _quote;
  bool _making = false;
  String? _aiError;
  bool _noCredit = false;
  String _requestId = _newRequestId();

  static String _newRequestId() => '${DateTime.now().microsecondsSinceEpoch}-${UniqueKey().hashCode.abs()}';

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  AppLocalizations get _text => AppLocalizations.of(context);

  String get _main {
    final a = widget.args;
    final s = a.sanskrit?.trim();
    return (s == null || s.isEmpty) ? a.title : s;
  }

  // ── Link ──
  Future<ShareLink?> _ensureLink() async {
    if (_link != null) return _link;
    try {
      final link = await ShareService.instance.linkFor(widget.args.kind, widget.args.targetId);
      if (mounted) setState(() => _link = link);
      return link;
    } on ApiFailure {
      if (mounted) AppNavigator.instance.showMessage(_text.shareLinkFailed);
      return null;
    }
  }

  // ── Picture ──
  /// Checks the file's real bytes, not its name: JPEG, PNG or WebP only.
  static bool _isSupportedImage(Uint8List b) {
    if (b.length < 12) return false;
    final jpeg = b[0] == 0xFF && b[1] == 0xD8;
    final png = b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47;
    final webp = b[0] == 0x52 && b[1] == 0x49 && b[8] == 0x57 && b[9] == 0x45;
    return jpeg || png || webp;
  }

  Future<void> _pickPicture() async {
    try {
      final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400, maxHeight: 2400);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      if (bytes.length > _maxPictureBytes || !_isSupportedImage(bytes)) {
        if (mounted) AppNavigator.instance.showMessage(_text.sharePictureInvalid);
        return;
      }
      if (!mounted) return;
      setState(() => _design = _design.copyWith(background: MemoryImage(bytes)));
    } on PlatformException {
      // Permission refused or the picker failed: nothing to apply.
    }
  }

  // ── AI background ──
  Future<void> _loadQuote() async {
    try {
      final quote = await ShareService.instance.backgroundQuote();
      if (mounted) setState(() => _quote = quote);
    } on ApiFailure {
      if (mounted) setState(() => _quote = const BackgroundQuote(available: false, canAfford: false, backgroundsLeft: 0));
    }
  }

  Future<void> _makeBackground() async {
    setState(() {
      _making = true;
      _aiError = null;
      _noCredit = false;
    });
    try {
      final url = await ShareService.instance.makeBackground(requestId: _requestId, prompt: _prompt.text);
      final image = NetworkImage(url);
      // Wait until it is decoded, so an export taken right now has the picture in it.
      if (mounted) await precacheImage(image, context);
      if (!mounted) return;
      setState(() {
        _design = _design.copyWith(background: image, darken: _design.darken < 0.25 ? 0.25 : _design.darken);
        _requestId = _newRequestId(); // a new picture is a new request
      });
      unawaited(_loadQuote());
    } on ApiFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        if (failure.statusCode == 402) {
          _noCredit = true;
        } else {
          _aiError = _text.shareAiFailed;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _aiError = _text.shareAiFailed);
    } finally {
      if (mounted) setState(() => _making = false);
    }
  }

  // ── Export and share ──
  Future<File?> _exportPng() async {
    final boundary = _cardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;
    // 360 logical pixels × 3 = a 1080-pixel-wide picture, whatever the phone's own density.
    final image = await boundary.toImage(pixelRatio: 3);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) return null;
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/hariharibol-share-${DateTime.now().millisecondsSinceEpoch}.png');
    return file.writeAsBytes(data.buffer.asUint8List(), flush: true);
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (_) {
      if (mounted) AppNavigator.instance.showMessage(_text.shareExportFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sharePicture() => _run(() async {
        final link = await _ensureLink();
        final file = await _exportPng();
        if (file == null) {
          if (mounted) AppNavigator.instance.showMessage(_text.shareExportFailed);
          return;
        }
        // The share sheet's result is not a promise that anyone received it, and is not reported as one.
        final result = await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: link?.url));
        if (result.status == ShareResultStatus.success) widget.args.onShared?.call();
      });

  Future<void> _shareLink() => _run(() async {
        final link = await _ensureLink();
        if (link == null) return;
        final result = await SharePlus.instance.share(ShareParams(text: link.url));
        if (result.status == ShareResultStatus.success) widget.args.onShared?.call();
      });

  String _textOf({String? url}) => [
        _main,
        if (_design.showMeaning && (widget.args.meaning ?? '').trim().isNotEmpty) widget.args.meaning!.trim(),
        if (_design.showReference) '— ${widget.args.title}',
        ?url,
      ].join('\n\n');

  Future<void> _copyText() => _run(() async {
        await Clipboard.setData(ClipboardData(text: _textOf()));
        if (mounted) AppNavigator.instance.showMessage(_text.shareTextCopied);
      });

  Future<void> _copyLink() => _run(() async {
        final link = await _ensureLink();
        if (link == null) return;
        await Clipboard.setData(ClipboardData(text: link.url));
        if (mounted) AppNavigator.instance.showMessage(_text.shareLinkCopied);
      });

  void _setTab(_Tab tab) {
    setState(() => _tab = tab);
    if (tab == _Tab.ai && _quote == null) unawaited(_loadQuote());
  }

  @override
  Widget build(BuildContext context) {
    final text = _text;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(text.shareStudioTitle, style: context.texts.headlineSmall)),
      body: ListView(
        padding: AppSpacing.page,
        children: [
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: FittedBox(
                child: RepaintBoundary(
                  key: _cardKey,
                  child: ShareCard(
                    design: _design,
                    main: _main,
                    meaning: widget.args.meaning,
                    reference: widget.args.title,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          Wrap(
            spacing: AppSpacing.sm,
            children: [
              for (final f in ShareFormat.values)
                ChoiceChip(
                  label: Text(switch (f) {
                    ShareFormat.square => text.shareSizeSquare,
                    ShareFormat.portrait => text.shareSizePortrait,
                    ShareFormat.story => text.shareSizeStory,
                  }),
                  selected: _design.format == f,
                  onSelected: (_) => setState(() => _design = _design.copyWith(format: f)),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          Text(text.shareBackground, style: context.texts.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              ChoiceChip(label: Text(text.shareGradients), selected: _tab == _Tab.gradients, onSelected: (_) => _setTab(_Tab.gradients)),
              ChoiceChip(label: Text(text.shareColours), selected: _tab == _Tab.colours, onSelected: (_) => _setTab(_Tab.colours)),
              ChoiceChip(label: Text(text.sharePicture), selected: _tab == _Tab.picture, onSelected: (_) => _setTab(_Tab.picture)),
              ChoiceChip(label: Text(text.shareMakeWithAi), selected: _tab == _Tab.ai, onSelected: (_) => _setTab(_Tab.ai)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _backgroundPanel(text, scheme),
          const SizedBox(height: AppSpacing.md),
          Text(text.shareDarken, style: context.texts.bodySmall),
          Slider(
            value: _design.darken,
            max: 0.8,
            onChanged: (v) => setState(() => _design = _design.copyWith(darken: v)),
          ),
          const SizedBox(height: AppSpacing.lg),

          Text(text.shareText, style: context.texts.titleMedium),
          Text(text.shareTextSize, style: context.texts.bodySmall),
          Slider(
            value: _design.textScale,
            min: 0.6,
            max: 1.6,
            onChanged: (v) => setState(() => _design = _design.copyWith(textScale: v)),
          ),
          SegmentedButton<TextAlign>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: TextAlign.left, icon: Icon(Icons.format_align_left_rounded)),
              ButtonSegment(value: TextAlign.center, icon: Icon(Icons.format_align_center_rounded)),
              ButtonSegment(value: TextAlign.right, icon: Icon(Icons.format_align_right_rounded)),
            ],
            selected: {_design.align},
            onSelectionChanged: (s) => setState(() => _design = _design.copyWith(align: s.first)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(text.shareLightText),
            value: _design.lightText,
            onChanged: (v) => setState(() => _design = _design.copyWith(lightText: v)),
          ),
          if ((widget.args.meaning ?? '').trim().isNotEmpty)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(text.shareShowMeaning),
              value: _design.showMeaning,
              onChanged: (v) => setState(() => _design = _design.copyWith(showMeaning: v)),
            ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(text.shareShowReference),
            value: _design.showReference,
            onChanged: (v) => setState(() => _design = _design.copyWith(showReference: v)),
          ),
          const SizedBox(height: AppSpacing.lg),

          FilledButton.icon(
            onPressed: _busy ? null : _sharePicture,
            icon: const Icon(Icons.ios_share_rounded),
            label: Text(text.shareImage),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              OutlinedButton(onPressed: _busy ? null : _shareLink, child: Text(text.shareLinkOnly)),
              OutlinedButton(onPressed: _busy ? null : _copyLink, child: Text(text.shareCopyLink)),
              OutlinedButton(onPressed: _busy ? null : _copyText, child: Text(text.shareCopyText)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _backgroundPanel(AppLocalizations text, ColorScheme scheme) {
    switch (_tab) {
      case _Tab.gradients:
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (var i = 0; i < AppColors.shareGradients.length; i++)
              _Swatch(
                selected: _design.background == null && _design.solid == null && _design.gradient == i,
                decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: AppColors.shareGradients[i])),
                onTap: () => setState(() => _design = _design.copyWith(gradient: i, clearBackground: true, clearSolid: true)),
              ),
          ],
        );
      case _Tab.colours:
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final c in AppColors.shareSolids)
              _Swatch(
                selected: _design.background == null && _design.solid == c,
                decoration: BoxDecoration(color: c),
                onTap: () => setState(() => _design = _design.copyWith(solid: c, clearBackground: true, lightText: c.computeLuminance() < 0.5)),
              ),
          ],
        );
      case _Tab.picture:
        return Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: _pickPicture,
            icon: const Icon(Icons.photo_outlined),
            label: Text(text.shareChoosePicture),
          ),
        );
      case _Tab.ai:
        final quote = _quote;
        if (quote != null && !quote.available) return Text(text.shareAiUnavailable);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _prompt,
              maxLength: 400,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(labelText: text.shareAiPrompt),
            ),
            Text(text.shareAiNote, style: context.texts.bodySmall),
            const SizedBox(height: AppSpacing.sm),
            if (_noCredit) ...[
              Text(text.shareAiNoCredit, style: TextStyle(color: scheme.error)),
              TextButton(
                onPressed: () => AppNavigator.instance.push(AppRoutes.plans),
                child: Text(text.shareAiSeePlans),
              ),
            ],
            if (_aiError != null) Text(_aiError!, style: TextStyle(color: scheme.error)),
            FilledButton(
              onPressed: _making || _prompt.text.trim().length < 3 || (quote != null && !quote.canAfford) ? null : _makeBackground,
              child: Text(_making ? text.shareAiMaking : text.shareAiMake),
            ),
            if (quote != null && !quote.canAfford && !_noCredit)
              TextButton(
                onPressed: () => AppNavigator.instance.push(AppRoutes.plans),
                child: Text(text.shareAiSeePlans),
              ),
          ],
        );
    }
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.selected, required this.decoration, required this.onTap});

  final bool selected;
  final BoxDecoration decoration;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 44,
        height: 44,
        decoration: decoration.copyWith(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? Theme.of(context).colorScheme.onSurface : Colors.transparent, width: 2),
        ),
      ),
    );
  }
}
