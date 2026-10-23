import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/mantra.dart';
import '../../providers/chat_provider.dart';
import '../../providers/own_mantra_provider.dart';
import '../../services/chat_image_picker.dart';
import 'own_mantra_problem.dart';

/// Where a mantra's picture comes from: the camera or the photo library, with
/// a plain line about who will see it. Null when the reader backs out.
Future<PictureSource?> chooseMantraPicture(BuildContext context) {
  return showModalBottomSheet<PictureSource>(
    context: context,
    useRootNavigator: true,
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
                    Icon(Icons.info_outline_rounded, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(text.ownMantraPictureNote, style: context.texts.bodySmall)),
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

/// Asks where the picture comes from, takes it and reads it. Null when the
/// reader backs out or refuses access (that is told here).
Future<Uint8List?> pickMantraPicture(BuildContext context, WidgetRef ref) async {
  final source = await chooseMantraPicture(context);
  if (source == null || !context.mounted) return null;

  final text = AppLocalizations.of(context);
  try {
    final path = await ref.read(chatImagePickerProvider).pick(source);
    return path == null ? null : await File(path).readAsBytes();
  } on PictureAccessDenied {
    AppNavigator.instance.showMessage(text.chatPictureDenied);
    return null;
  }
}

/// Chooses a picture and sends it as the picture of [slug], a mantra the reader
/// added. Returns the mantra with its new picture, or null when nothing changed
/// (the reader backed out, or it failed and they were told why).
Future<Mantra?> changeMantraPicture(BuildContext context, WidgetRef ref, String slug) async {
  final text = AppLocalizations.of(context);
  final bytes = await pickMantraPicture(context, ref);
  if (bytes == null) return null;

  try {
    final mantra = await ref.read(ownMantraServiceProvider).changeImage(slug, bytes);
    invalidateMantras(ref.invalidate, slugs: [slug]);
    AppNavigator.instance.showMessage(text.ownMantraPictureSaved);
    return mantra;
  } on ApiFailure catch (failure) {
    AppNavigator.instance.showMessage(ownMantraProblem(text, failure));
    return null;
  }
}
