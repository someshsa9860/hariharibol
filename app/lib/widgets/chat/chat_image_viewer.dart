import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// A picture from the chat, large: pinch to zoom, tap the close button to leave.
/// Shows the file on this phone when there is one, else the server's link.
Future<void> showChatImage(BuildContext context, {String? path, String? url}) {
  return showDialog<void>(
    context: context,
    useSafeArea: false,
    builder: (_) => _ChatImageViewer(path: path, url: url),
  );
}

class _ChatImageViewer extends StatelessWidget {
  const _ChatImageViewer({this.path, this.url});

  final String? path;
  final String? url;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final broken = Icon(Icons.broken_image_outlined, size: AppSizes.iconLg, color: context.colors.onSurfaceVariant);

    final Widget picture = path != null
        ? Image.file(File(path!), fit: BoxFit.contain, errorBuilder: (_, _, _) => broken)
        : CachedNetworkImage(
            imageUrl: url ?? '',
            fit: BoxFit.contain,
            errorWidget: (_, _, _) => broken,
          );

    return Dialog.fullscreen(
      backgroundColor: context.colors.surface,
      child: Stack(
        children: [
          Positioned.fill(
            child: Semantics(
              image: true,
              label: text.chatImageSemantics,
              child: InteractiveViewer(maxScale: 5, child: Center(child: picture)),
            ),
          ),
          PositionedDirectional(
            top: MediaQuery.paddingOf(context).top + AppSpacing.sm,
            end: AppSpacing.sm,
            child: IconButton.filledTonal(
              tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
        ],
      ),
    );
  }
}
