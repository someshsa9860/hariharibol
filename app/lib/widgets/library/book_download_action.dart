import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/book_provider.dart';

/// The book detail app bar's download toggle: an icon that offers to save the
/// whole book offline, spins while it does, and turns into a check once it
/// has. Tapping it while a download is already running does nothing — the
/// notifier itself guards against a second one starting.
class BookDownloadAction extends ConsumerWidget {
  const BookDownloadAction({super.key, required this.slug});

  final String slug;

  /// [failedMessage] is resolved before the call, not after — the widget has
  /// no `mounted` flag to guard a post-`await` `BuildContext` lookup the way a
  /// `State` would.
  Future<void> _start(WidgetRef ref, String failedMessage) async {
    try {
      await ref.read(bookDownloadProvider(slug).notifier).start();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } catch (_) {
      AppNavigator.instance.showMessage(failedMessage);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final download = ref.watch(bookDownloadProvider(slug));
    final phase = download.value?.phase ?? BookDownloadPhase.idle;

    if (phase == BookDownloadPhase.downloading) {
      final progress = download.value?.progress ?? 0;
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: SizedBox(
          width: AppSizes.iconMd,
          height: AppSizes.iconMd,
          child: CircularProgressIndicator(strokeWidth: 2, value: progress > 0 ? progress : null),
        ),
      );
    }

    final isDone = phase == BookDownloadPhase.done;
    return IconButton(
      icon: Icon(isDone ? Icons.download_done_rounded : Icons.download_rounded),
      tooltip: isDone ? text.libraryDownloaded : text.libraryDownloadBook,
      onPressed: isDone ? null : () => _start(ref, text.libraryDownloadFailed),
    );
  }
}
