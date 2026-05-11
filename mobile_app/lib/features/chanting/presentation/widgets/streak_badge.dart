import 'package:flutter/material.dart';

const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);

class StreakBadge extends StatelessWidget {
  final int streak;
  final bool compact;

  const StreakBadge({super.key, required this.streak, this.compact = false});

  @override
  Widget build(BuildContext context) {
    if (streak == 0) return const SizedBox.shrink();

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_saffron, _saffronDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _saffron.withOpacity(0.35),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '🔥',
            style: TextStyle(fontSize: compact ? 12 : 14),
          ),
          const SizedBox(width: 4),
          Text(
            '$streak ${streak == 1 ? 'day' : 'days'}',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: compact ? 11 : 13,
            ),
          ),
        ],
      ),
    );
  }
}
