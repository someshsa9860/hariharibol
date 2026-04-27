import 'package:flutter/material.dart';

class AppleSignInButton extends StatefulWidget {
  final VoidCallback onPressed;

  const AppleSignInButton({
    super.key,
    required this.onPressed,
  });

  @override
  State<AppleSignInButton> createState() => _AppleSignInButtonState();
}

class _AppleSignInButtonState extends State<AppleSignInButton> {
  bool _isLoading = false;

  void _handlePress() async {
    setState(() => _isLoading = true);
    try {
      await widget.onPressed();
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handlePress,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1A1A1A),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Colors.white, width: 1.5),
          ),
          disabledBackgroundColor: Colors.grey[800],
        ),
        child: _isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    Color(0xFFC75A1A),
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.apple, size: 24),
                  const SizedBox(width: 12),
                  Text(
                    'Continue with Apple',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
      ),
    );
  }
}
