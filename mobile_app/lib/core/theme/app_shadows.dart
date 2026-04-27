import 'package:flutter/material.dart';

class AppShadows {
  static const BoxShadow small = BoxShadow(
    color: Color(0x1F000000),
    blurRadius: 4,
    offset: Offset(0, 2),
  );

  static const BoxShadow medium = BoxShadow(
    color: Color(0x29000000),
    blurRadius: 8,
    offset: Offset(0, 4),
  );

  static const BoxShadow large = BoxShadow(
    color: Color(0x33000000),
    blurRadius: 16,
    offset: Offset(0, 8),
  );
}