import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'dart:io';

class AdaptiveButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onPressed;

  const AdaptiveButton({
    super.key,
    required this.child,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    if (Platform.isIOS) {
      return CupertinoButton(
        onPressed: onPressed,
        child: child,
      );
    } else {
      return ElevatedButton(
        onPressed: onPressed,
        child: child,
      );
    }
  }
}