import 'package:flutter/material.dart';

// Small peacock-colored chip displaying a tradition name
class SampradayaChip extends StatelessWidget {
  final String name;
  final VoidCallback? onTap;
  final bool isSelected;

  const SampradayaChip({
    super.key,
    required this.name,
    this.onTap,
    this.isSelected = false,
  });

  static const _peacock = Color(0xFF006B6B);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? _peacock : _peacock.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? _peacock : _peacock.withValues(alpha: 0.35),
            width: 1.2,
          ),
        ),
        child: Text(
          name,
          style: TextStyle(
            color: isSelected ? Colors.white : _peacock,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
