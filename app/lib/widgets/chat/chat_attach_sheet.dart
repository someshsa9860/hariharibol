import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/chat_image_picker.dart';

/// Where a picture for Sakha comes from: the camera or the photo library, with
/// a plain line about where it goes. Null when the reader backs out.
Future<PictureSource?> chooseChatPicture(BuildContext context) {
  return showModalBottomSheet<PictureSource>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      final text = AppLocalizations.of(context);
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: Text(text.chatAttachCamera),
                onTap: () => Navigator.of(context).pop(PictureSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: Text(text.chatAttachGallery),
                onTap: () => Navigator.of(context).pop(PictureSource.gallery),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.lock_outline_rounded, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(text.chatAttachNote, style: context.texts.bodySmall)),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
