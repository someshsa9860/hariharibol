import 'package:flutter/cupertino.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// What the middle of the chanting page shows.
enum ChantPageView {
  /// The deity's picture inside the mala: the way the page has always been.
  deity,

  /// A quote, a new one after every 12 chants.
  quotes;

  /// The value kept on the phone.
  String get stored => name;

  static ChantPageView fromStored(String? value) =>
      ChantPageView.values.firstWhere((view) => view.name == value, orElse: () => ChantPageView.deity);
}

/// The iOS-style sliding switch under the summary: Deity | Quotes. The change
/// is the parent's to make; this only says which one was chosen.
class ChantViewSwitch extends StatelessWidget {
  const ChantViewSwitch({super.key, required this.value, required this.onChanged});

  final ChantPageView value;
  final ValueChanged<ChantPageView> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final selected = context.colors.onPrimary;
    final idle = context.colors.onSurfaceVariant;

    Widget label(String words, bool isSelected) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs, horizontal: AppSpacing.sm),
          child: Text(
            words,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.texts.labelLarge?.copyWith(color: isSelected ? selected : idle),
          ),
        );

    return Semantics(
      container: true,
      label: text.chantViewLabel,
      child: SizedBox(
        width: double.infinity,
        child: CupertinoSlidingSegmentedControl<ChantPageView>(
          groupValue: value,
          backgroundColor: context.colors.surfaceContainerHighest,
          thumbColor: context.colors.primary,
          onValueChanged: (view) {
            if (view != null) onChanged(view);
          },
          children: {
            ChantPageView.deity: label(text.chantViewDeity, value == ChantPageView.deity),
            ChantPageView.quotes: label(text.chantViewQuotes, value == ChantPageView.quotes),
          },
        ),
      ),
    );
  }
}
