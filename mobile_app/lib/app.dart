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
    final fontSize = ref.watch(fontSizeProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: F.title,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      locale: locale,
      routerConfig: router,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(fontSize),
        ),
        child: child!,
      ),
      localizationsDelegates: const [
        // Add localization delegates here as needed
      ],
      supportedLocales: const [
        Locale('en', ''),
        Locale('hi', ''),
        Locale('bn', ''),
        Locale('te', ''),
        Locale('mr', ''),
        Locale('ta', ''),
        Locale('fr', ''),
        Locale('gu', ''),
        Locale('kn', ''),
        Locale('ml', ''),
        Locale('pa', ''),
        Locale('es', ''),
        Locale('de', ''),
        Locale('pt', ''),
      ],
    );
  }
}
