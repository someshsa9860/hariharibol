import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/mantra_provider.dart';
import '../common/app_loader.dart';

/// Empty string, not null, means "clear the preference" — null alone already
/// means "the sheet was dismissed without a choice," and the two have to stay
/// distinguishable. No real mantra id is ever empty, so it is free to reuse.
const String clearPreferredMantra = '';

/// Every published mantra, for picking the one "Chant now" opens with.
/// [currentId] is what carries the checkmark; the sheet itself never writes
/// the preference, only returns what was tapped.
Future<String?> showMantraPickerSheet(BuildContext context, {String? currentId}) {
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _MantraPickerSheet(currentId: currentId),
  );
}

class _MantraPickerSheet extends ConsumerWidget {
  const _MantraPickerSheet({required this.currentId});

  final String? currentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final mantras = ref.watch(mantraListProvider(null));

    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Text(text.settingsChooseMantraTitle, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text(
                text.settingsChooseMantraSubtitle,
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: mantras.when(
                  loading: () => const AppLoader(),
                  error: (_, _) => Center(
                    child: Text(
                      text.errorGeneric,
                      style: context.texts.bodyMedium?.copyWith(
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                  data: (list) => ListView(
                    children: [
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(text.settingsNoMantraPreference),
                        trailing: currentId == null
                            ? Icon(Icons.check_rounded, color: context.colors.primary)
                            : null,
                        onTap: () => Navigator.of(context).pop(clearPreferredMantra),
                      ),
                      for (final mantra in list)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(mantra.name),
                          subtitle: Text(
                            mantra.text,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: currentId == mantra.id
                              ? Icon(Icons.check_rounded, color: context.colors.primary)
                              : null,
                          onTap: () => Navigator.of(context).pop(mantra.id),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
