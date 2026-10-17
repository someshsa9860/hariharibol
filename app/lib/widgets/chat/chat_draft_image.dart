import 'dart:io';

import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_state.dart';

/// The picture waiting above the message box: a thumbnail with a remove button,
/// and, while it goes up or when it fails, a line saying so (with a tap to try
/// again where trying again can help). The state is in words and an icon, never
/// in colour.
class ChatDraftImageStrip extends StatelessWidget {
  const ChatDraftImageStrip({super.key, required this.image, required this.onRemove, required this.onRetry});

  final ChatDraftImage image;
  final VoidCallback onRemove;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final note = _note(text);
    final size = ChatConfig.draftThumbnail;

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Semantics(
                image: true,
                label: text.chatImageSemantics,
                child: ClipRRect(
                  borderRadius: AppRadius.mdAll,
                  child: SizedBox.square(
                    dimension: size,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.file(
                          File(image.path),
                          fit: BoxFit.cover,
                          cacheWidth: (size * MediaQuery.devicePixelRatioOf(context)).round(),
                          errorBuilder: (_, _, _) => ColoredBox(
                            color: context.colors.surfaceContainerHighest,
                            child: Icon(Icons.image_outlined, color: context.colors.onSurfaceVariant),
                          ),
                        ),
                        if (!image.ready)
                          ColoredBox(
                            color: context.colors.surface.withValues(alpha: 0.72),
                            child: Center(
                              child: image.uploading
                                  ? const SizedBox.square(
                                      dimension: AppSizes.iconMd,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : Icon(
                                      image.canRetry ? Icons.refresh_rounded : Icons.error_outline_rounded,
                                      color: context.colors.onSurface,
                                    ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              PositionedDirectional(
                top: -AppSpacing.sm,
                end: -AppSpacing.sm,
                child: IconButton.filledTonal(
                  tooltip: text.chatImageRemove,
                  visualDensity: VisualDensity.compact,
                  iconSize: AppSizes.iconSm,
                  onPressed: onRemove,
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
            ],
          ),
          if (note != null) ...[
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: image.canRetry ? onRetry : null,
                child: Text(note, style: context.texts.bodySmall),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String? _note(AppLocalizations text) {
    if (image.uploading) return text.chatImageUploading;
    return switch (image.problem) {
      ChatImageProblem.couldNotUpload => text.chatImageFailed,
      ChatImageProblem.notUsable => text.chatImageRejected,
      ChatImageProblem.notAvailable => text.chatImageOff,
      null => null,
    };
  }
}
