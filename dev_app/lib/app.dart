import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/navigation/app_router.dart';
import 'core/session/app_session.dart';
import 'core/theme/app_theme.dart';
import 'l10n/generated/app_localizations.dart';
import 'services/api_client.dart';
import 'services/socket_service.dart';

/// The root widget. It builds the router once, keeps the websocket open while someone is signed in, and tells
/// the server whether the app is on screen (so pushes are held back while it is).
class DevApp extends ConsumerStatefulWidget {
  const DevApp({super.key});

  @override
  ConsumerState<DevApp> createState() => _DevAppState();
}

class _DevAppState extends ConsumerState<DevApp> with WidgetsBindingObserver {
  late final GoRouter _router = createRouter();
  final SocketService _socket = SocketService.instance;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AppSession.instance.addListener(_onSession);
    _onSession();
    unawaited(ApiClient.instance.renewAccessTokenIfDue());
  }

  @override
  void dispose() {
    AppSession.instance.removeListener(_onSession);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // The socket follows the session: open while signed in, closed otherwise.
  void _onSession() {
    if (AppSession.instance.isSignedIn) {
      _socket.start();
    } else {
      _socket.stop();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    _socket.setForeground(foreground);
    if (foreground) unawaited(ApiClient.instance.renewAccessTokenIfDue());
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
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
