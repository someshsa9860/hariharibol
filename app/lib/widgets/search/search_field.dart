import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// The search box that sits in the app bar: a rounded, filled field with a
/// search icon, and a clear button once something is typed.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.hint,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
    this.autofocus = true,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    const shape = BorderRadius.all(Radius.circular(AppRadius.pill));

    return SizedBox(
      height: 46,
      child: TextField(
        controller: controller,
        autofocus: autofocus,
        textInputAction: TextInputAction.search,
        textCapitalization: TextCapitalization.none,
        autocorrect: false,
        style: context.texts.bodyLarge,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: context.texts.bodyLarge?.copyWith(color: colors.onSurfaceVariant),
          filled: true,
          fillColor: colors.surfaceContainerHighest,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          prefixIcon: Icon(Icons.search_rounded, color: colors.onSurfaceVariant),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) => value.text.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    icon: Icon(Icons.close_rounded, color: colors.onSurfaceVariant),
                    onPressed: onClear,
                  ),
          ),
          border: const OutlineInputBorder(borderRadius: shape, borderSide: BorderSide.none),
          enabledBorder: const OutlineInputBorder(borderRadius: shape, borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
            borderRadius: shape,
            borderSide: BorderSide(color: colors.primary, width: 1.5),
          ),
        ),
      ),
    );
  }
}
