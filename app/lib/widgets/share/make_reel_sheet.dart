import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/share_links.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/reel_music_picker.dart';
import '../../services/reel_service.dart';
import '../common/peacock_feather_icon.dart';
import 'share_target.dart';

/// Turns the share card into a reel: the reader may add music from their own
/// files, then posts. The reel is live for everyone as soon as the server
/// answers — it makes the reader a creator without a review.
///
/// Pops with true once the reel is posted.
class MakeReelSheet extends StatefulWidget {
  const MakeReelSheet({super.key, required this.card, required this.target});

  /// The card as a PNG, exactly as the reader designed it.
  final Uint8List card;
  final ShareTarget target;

  static Future<bool?> open(BuildContext context, {required Uint8List card, required ShareTarget target}) {
    return showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => MakeReelSheet(card: card, target: target),
    );
  }

  @override
  State<MakeReelSheet> createState() => _MakeReelSheetState();
}

enum _Problem { none, failed, tooBig }

class _MakeReelSheetState extends State<MakeReelSheet> {
  PickedMusic? _music;
  bool _busy = false;
  _Problem _problem = _Problem.none;

  Future<void> _pickMusic() async {
    final music = await ReelMusicPicker.instance.pick();
    if (music == null || !mounted) return;
    if (music.bytes > ReelMusicPicker.maxBytes) {
      setState(() => _problem = _Problem.tooBig);
      return;
    }
    setState(() {
      _music = music;
      _problem = _Problem.none;
    });
  }

  Future<void> _post() async {
    setState(() {
      _busy = true;
      _problem = _Problem.none;
    });
    try {
      final service = ReelService.instance;
      final imageKey = await service.uploadMedia(audio: false, bytes: widget.card, contentType: 'image/png');
      final music = _music;
      final audioKey = music == null ? null : await service.uploadMusicFile(music.path, music.contentType);
      await service.make(
        imageKey: imageKey,
        audioKey: audioKey,
        caption: widget.target.title,
        mantraSlug: widget.target.type == ShareType.mantra ? widget.target.id : null,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => _problem = failure.code == 'MEDIA_TOO_LARGE' ? _Problem.tooBig : _Problem.failed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final music = _music;

    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const PeacockFeatherIcon(size: 26),
              const SizedBox(width: AppSpacing.sm),
              Text(text.shareMakeReel, style: context.texts.titleLarge),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(text.shareReelIntro, style: context.texts.bodyMedium),
          const SizedBox(height: AppSpacing.md),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(widget.card)),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ActionChip(
                avatar: const Icon(Icons.library_music_outlined, size: 18),
                label: Text(music == null ? text.shareReelAddMusic : text.shareReelMusic(music.name)),
                onPressed: _busy ? null : _pickMusic,
              ),
              if (music != null)
                ActionChip(
                  avatar: const Icon(Icons.close_rounded, size: 18),
                  label: Text(text.shareReelRemoveMusic),
                  onPressed: _busy ? null : () => setState(() => _music = null),
                ),
            ],
          ),
          if (_problem != _Problem.none) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_problem == _Problem.tooBig ? text.shareReelTooBig : text.shareReelFailed, style: context.texts.bodyMedium),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: _busy ? null : _post,
            icon: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const PeacockFeatherIcon(size: 20, color: Colors.white),
            label: Text(_busy ? text.shareReelPosting : text.shareReelPost),
          ),
        ],
      ),
    );
  }
}
