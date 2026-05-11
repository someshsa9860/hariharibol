import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/config/flavors.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/settings/presentation/providers/settings_providers.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeProvider);
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      title: F.title,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      locale: locale,
      routerConfig: AppRouter.router,
      localizationsDelegates: const [
        // Add localization delegates
      ],
      supportedLocales: const [
        Locale('en', ''),
        Locale('hi', ''),
        Locale('bn', ''),
        Locale('te', ''),
        Locale('mr', ''),
        Locale('ta', ''),
        Locale('fr', ''),
      ],
    );
  }
}
