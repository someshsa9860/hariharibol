import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'core/navigation/app_navigator.dart';
import 'core/navigation/app_router.dart';
import 'core/theme/app_theme.dart';
import 'l10n/generated/app_localizations.dart';

/// The root widget.
///
/// It builds the router once — rebuilding it would reset the whole navigation
/// stack — and hands the theme, the localisations and the messenger key to
/// `MaterialApp`. Nothing else lives here.
class HariHariBolApp extends StatefulWidget {
  const HariHariBolApp({super.key});

  @override
  State<HariHariBolApp> createState() => _HariHariBolAppState();
}

class _HariHariBolAppState extends State<HariHariBolApp> {
  late final GoRouter _router = createRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      scaffoldMessengerKey: AppNavigator.instance.messengerKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      // The system decides for now. A per-account setting can be added later
      // without touching anything but this line.
      themeMode: ThemeMode.system,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
