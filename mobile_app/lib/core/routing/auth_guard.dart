import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AuthGuard {
  static String? redirect(BuildContext context, GoRouterState state) {
    // Check if user is authenticated
    // If not, redirect to login
    // return RoutePaths.login;
    return null; // Allow
  }
}