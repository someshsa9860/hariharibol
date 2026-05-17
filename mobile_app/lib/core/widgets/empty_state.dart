import 'package:flutter/material.dart';

// Empty state: Om symbol, configurable message, optional CTA button
class EmptyStateWidget extends StatelessWidget {
  final String message;
  final String? subMessage;
  final String? ctaLabel;
  final VoidCallback? onCta;
  final String symbol;

  const EmptyStateWidget({
    super.key,
    required this.message,
    this.subMessage,
    this.ctaLabel,
    this.onCta,
    this.symbol = '🕉️',
  });

  static const _saffron = Color(0xFFFF6B00);
  static const _textDark = Color(0xFF1C1209);
  static const _textMid = Color(0xFF7A6050);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(symbol, style: const TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                color: _textDark,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            if (subMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                subMessage!,
                style: const TextStyle(
                  color: _textMid,
                  fontSize: 13,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (ctaLabel != null && onCta != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: onCta,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _saffron,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  ctaLabel!,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Legacy simple empty state (kept for backward compatibility)
class EmptyState extends StatelessWidget {
  final String message;
  final IconData icon;

  const EmptyState({
    super.key,
    required this.message,
    this.icon = Icons.inbox,
  });

  @override
  Widget build(BuildContext context) {
    return EmptyStateWidget(message: message);
  }
}
