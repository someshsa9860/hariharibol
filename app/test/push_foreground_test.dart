import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/widgets/push/push_foreground.dart';

void main() {
  testWidgets('with Firebase not configured it only shows its child', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => PushForeground(child: child ?? const SizedBox.shrink()),
        home: const Text('home'),
      ),
    );

    expect(find.text('home'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('every language names the push channel', () async {
    for (final locale in AppLocalizations.supportedLocales) {
      final strings = await AppLocalizations.delegate.load(locale);
      expect(strings.pushChannelName.trim(), isNotEmpty, reason: locale.languageCode);
    }
  });
}
