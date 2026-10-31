import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/mantra.dart';
import '../../providers/mantra_provider.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import '../dashboard/mantra_list_tile.dart';

/// The mantras the reader can pick as a favourite, from the same list the Jap
/// tab shows. The list is only offered, never required: see the footer in
/// `SetupView`.
class SetupMantraList extends ConsumerWidget {
  const SetupMantraList({
    super.key,
    required this.chosen,
    required this.onChoose,
  });

  final Mantra? chosen;
  final ValueChanged<Mantra> onChoose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final mantras = ref.watch(mantraListProvider(null));

    return mantras.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
        onRetry: () async => ref.invalidate(mantraListProvider(null)),
      ),
      data: (list) {
        if (list.isEmpty) {
          return Center(
            child: Text(text.setupMantraNone, textAlign: TextAlign.center),
          );
        }
        return ListView.separated(
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, index) {
            final mantra = list[index];
            return MantraListTile(
              key: ValueKey(mantra.slug),
              name: mantra.name,
              text: mantra.text,
              category: mantra.category,
              deity: mantra.deity,
              guru: mantra.guru,
              imageUrl: mantra.imageUrl,
              imageCacheKey: mantra.imageCacheKey,
              isPrivate: mantra.isPrivate,
              hasAudio: mantra.hasAudio,
              selected: mantra.id == chosen?.id,
              onTap: () => onChoose(mantra),
            );
          },
        );
      },
    );
  }
}
