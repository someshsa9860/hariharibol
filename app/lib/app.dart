import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/layout/adaptive.dart';
import 'core/layout/app_scroll_behavior.dart';
import 'core/navigation/app_navigator.dart';
import 'core/navigation/app_router.dart';
import 'core/theme/app_theme.dart';
import 'l10n/generated/app_localizations.dart';
import 'providers/chant_sync_provider.dart';
import 'providers/language_settings_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/offline_warmer_provider.dart';
import 'providers/routine_sync_provider.dart';
import 'providers/theme_provider.dart';
import 'services/api_client.dart';
import 'services/book_sync_manager.dart';
import 'widgets/push/push_foreground.dart';
import 'widgets/routine/routine_alerts.dart';

/// The root widget.
///
/// It builds the router once — rebuilding it would reset the whole navigation
/// stack — and hands the theme, the localisations and the messenger key to
/// `MaterialApp`. Nothing else lives here (`PushForeground` draws a push that
/// arrives while the app is open, and `RoutineAlerts` sets the routine's task
/// alerts, so both wrap every screen), apart from two
/// errands. When the app opens or comes back to the front, an access token that
/// is a day old is swapped for a new one (see `ApiClient.renewAccessTokenIfDue`),
/// and the books on the phone are checked against the server for new text
/// (`BookSyncManager.checkForUpdates`, at most every quarter of an hour — and at
/// once when the reading language changes, because the language a reader has just
/// chosen is the one most likely to have been added to the files since).
class HariHariBolApp extends ConsumerStatefulWidget {
  const HariHariBolApp({super.key});

  @override
  ConsumerState<HariHariBolApp> createState() => _HariHariBolAppState();
}

class _HariHariBolAppState extends ConsumerState<HariHariBolApp> with WidgetsBindingObserver {
  late final GoRouter _router = createRouter();

  @override
  void initState() {
    super.initState();
    // Starts the routine's sync with the account (nothing, until someone is
    // signed in).
    ref.read(routineSyncerProvider);
    // The same for the chanting kept on the phone, which goes up in batches.
    ref.read(chantSyncerProvider);
    // And fetching ahead what the reader may open offline (the same).
    ref.read(offlineWarmerProvider);

    WidgetsBinding.instance.addObserver(this);
    unawaited(ApiClient.instance.renewAccessTokenIfDue());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // A phone can sit in a pocket for days; the first thing it does on waking
    // is renew, so the first screen never meets an expired token.
    if (state == AppLifecycleState.resumed) {
      unawaited(ApiClient.instance.renewAccessTokenIfDue());
      unawaited(BookSyncManager.instance.checkForUpdates());
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(languageSettingsProvider.select((s) => s.reading), (previous, next) {
      if (previous != next) unawaited(BookSyncManager.instance.checkForUpdates(force: true));
    });
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      scrollBehavior: const AppScrollBehavior(),
      builder: (context, child) => _SeatedForTheRoom(
        child: RoutineAlerts(child: PushForeground(child: child ?? const SizedBox.shrink())),
      ),
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

/// Text for the distance it is read from: a television is watched from a sofa, so
/// type is never smaller than [AdaptiveLayout.textScaleFloor] times its size,
/// whatever the system's text size says. Everywhere else this changes nothing.
class _SeatedForTheRoom extends StatelessWidget {
  const _SeatedForTheRoom({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final floor = AdaptiveLayout.of(context).textScaleFloor;
    if (floor <= 1) return child;
    final media = MediaQuery.of(context);
    final scale = media.textScaler.scale(1);
    if (scale >= floor) return child;
    return MediaQuery(data: media.copyWith(textScaler: TextScaler.linear(floor)), child: child);
  }
}
