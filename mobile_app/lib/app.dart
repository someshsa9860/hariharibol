import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/config/flavors.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: F.title,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      routerConfig: AppRouter.router,
      localizationsDelegates: const [
        // Add localization delegates
      ],
      supportedLocales: const [
        Locale('en', ''),
        // Add more locales
      ],
    );
  }
}