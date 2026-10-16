import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';

/// How markdown looks in an answer. Every value comes from the theme, so the
/// answer follows the palette in both modes and the colour rule needs no
/// exception: light is orange on white, dark is white on black.
///
/// Headings use the sans titles, not the serif: an answer mixes scripts, and
/// the serif has no Devanagari.
MarkdownStyleSheet chatMarkdownStyle(BuildContext context) {
  final texts = context.texts;
  final colors = context.colors;
  final body = texts.bodyLarge!;
  final code = AppTypography.code(context);
  final hairline = BorderSide(color: colors.outlineVariant);

  return MarkdownStyleSheet.fromTheme(context.theme).copyWith(
    p: body,
    pPadding: EdgeInsets.zero,
    a: body.copyWith(color: colors.primary, decoration: TextDecoration.underline),
    strong: body.copyWith(fontWeight: FontWeight.w700),
    em: body.copyWith(fontStyle: FontStyle.italic),
    del: body.copyWith(decoration: TextDecoration.lineThrough),
    h1: texts.titleLarge,
    h2: texts.titleMedium!.copyWith(fontSize: texts.titleLarge!.fontSize! * 0.92),
    h3: texts.titleMedium,
    h4: texts.titleSmall,
    h5: texts.titleSmall,
    h6: texts.titleSmall,
    code: code.copyWith(backgroundColor: colors.surfaceContainerHighest),
    codeblockPadding: const EdgeInsets.all(AppSpacing.md),
    codeblockDecoration: BoxDecoration(
      color: colors.surfaceContainerHighest,
      borderRadius: AppRadius.smAll,
      border: Border.fromBorderSide(hairline),
    ),
    // The shloka card draws its own frame.
    blockquote: body,
    blockquotePadding: EdgeInsets.zero,
    blockquoteDecoration: const BoxDecoration(),
    listBullet: body,
    blockSpacing: AppSpacing.md,
    listIndent: AppSpacing.lg,
    tableHead: body.copyWith(fontWeight: FontWeight.w700),
    tableBody: body,
    tableBorder: TableBorder.all(color: colors.outlineVariant),
    tableCellsPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
    tableHeadCellsDecoration: BoxDecoration(color: colors.surfaceContainerHighest),
    horizontalRuleDecoration: BoxDecoration(border: Border(top: hairline)),
  );
}
