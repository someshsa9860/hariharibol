import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/navigation/app_navigator.dart';
import 'core/navigation/app_router.dart';
import 'core/theme/app_theme.dart';
import 'l10n/generated/app_localizations.dart';
import 'providers/locale_provider.dart';
import 'providers/routine_sync_provider.dart';
import 'providers/theme_provider.dart';
import 'widgets/push/push_foreground.dart';

/// The root widget.
///
/// It builds the router once — rebuilding it would reset the whole navigation
/// stack — and hands the theme, the localisations and the messenger key to
/// `MaterialApp`. Nothing else lives here (`PushForeground` draws a push that
/// arrives while the app is open, so it wraps every screen).
class HariHariBolApp extends ConsumerStatefulWidget {
  const HariHariBolApp({super.key});

  @override
  ConsumerState<HariHariBolApp> createState() => _HariHariBolAppState();
}

class _HariHariBolAppState extends ConsumerState<HariHariBolApp> {
  late final GoRouter _router = createRouter();

  @override
  void initState() {
    super.initState();
    // Starts the routine's sync with the account (nothing, until someone is
    // signed in).
    ref.read(routineSyncerProvider);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      builder: (context, child) => PushForeground(child: child ?? const SizedBox.shrink()),
      scaffoldMessengerKey: AppNavigator.instance.messengerKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ref.watch(themeModeProvider),
      locale: ref.watch(appLocaleProvider),
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
