import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// One part of the Sources & disclaimer page: a heading, a paragraph under it,
/// and anything else the part needs below that.
class SourcesSection extends StatelessWidget {
  const SourcesSection({
    super.key,
    required this.title,
    this.body,
    this.children = const [],
  });

  final String title;
  final String? body;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final items = [
      if (body != null) Text(body!, style: context.texts.bodyMedium),
      ...children,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: context.texts.titleMedium),
        for (var i = 0; i < items.length; i++) ...[
          SizedBox(height: i == 0 ? AppSpacing.sm : AppSpacing.md),
          items[i],
        ],
      ],
    );
  }
}

/// A text and where it was taken from. The address can be selected and copied,
/// but is not a link — the page names its sources, it does not send anyone to them.
class SourceEntry extends StatelessWidget {
  const SourceEntry({super.key, required this.label, required this.address});

  final String label;
  final String address;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: context.texts.bodyMedium),
        const SizedBox(height: AppSpacing.xs),
        SelectableText(
          address,
          style: context.texts.bodySmall?.copyWith(color: context.colors.primary),
        ),
      ],
    );
  }
}
