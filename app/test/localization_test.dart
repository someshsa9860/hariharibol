// Text the app writes for itself has to come from the ARB, in the reader's
// language, wherever it is shown. These tests guard the seams that used to leak
// English: failures made on the phone (they carry no words, a code instead),
// the locale an account's language choice turns into, and the date line.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/format/failure_text.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/l10n/generated/app_localizations_en.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/providers/locale_provider.dart';
import 'package:hariharibol/widgets/common/app_error_view.dart';

void main() {
  final text = AppLocalizationsEn();

  group('ApiFailure.describe', () {
    test('uses the words the server sent', () {
      const failure = ApiFailure(kind: FailureKind.validation, message: 'Name is too long.');
      expect(failure.describe(text), 'Name is too long.');
    });

    test('names a failure made on the phone from its kind', () {
      expect(const ApiFailure(kind: FailureKind.timeout).describe(text), text.errorTimeout);
      expect(const ApiFailure(kind: FailureKind.network).describe(text), text.errorNetwork);
      expect(
        const ApiFailure(kind: FailureKind.unauthorized).describe(text),
        text.errorSessionExpired,
      );
      expect(const ApiFailure(kind: FailureKind.server).describe(text), text.errorGeneric);
    });

    test('names a failure made on the phone from its code', () {
      expect(const ApiFailure.signIn().describe(text), text.errorSignIn);
      expect(
        const ApiFailure(kind: FailureKind.network, code: ClientFailureCode.insecureConnection)
            .describe(text),
        text.errorInsecureConnection,
      );
      expect(
        const ApiFailure(kind: FailureKind.unknown, code: ClientFailureCode.cancelled)
            .describe(text),
        text.errorCancelled,
      );
    });

    test('an empty server message falls back rather than showing nothing', () {
      const failure = ApiFailure(kind: FailureKind.notFound, message: '');
      expect(failure.describe(text), text.errorGeneric);
    });
  });

  group('shippedLocaleFor', () {
    test('returns each language the app ships', () {
      for (final locale in AppLocalizations.supportedLocales) {
        expect(shippedLocaleFor(locale.languageCode), locale);
      }
    });

    test('returns null for a language with no ARB file, instead of one that would crash', () {
      expect(shippedLocaleFor('zz'), isNull);
      expect(shippedLocaleFor(''), isNull);
      expect(shippedLocaleFor(null), isNull);
    });
  });

  group('on screen', () {
    Widget app(Widget home) => MaterialApp(
          scaffoldMessengerKey: AppNavigator.instance.messengerKey,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: home),
        );

    testWidgets('the date line keeps its shape, with the date data the app really loads', (
      tester,
    ) async {
      late AppLocalizations loaded;
      await tester.pumpWidget(
        app(
          Builder(
            builder: (context) {
              loaded = AppLocalizations.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      // Not `AppLocalizationsEn()` on its own: a bare DateFormat in a unit test
      // has no locale data, and the home header would swallow that and show
      // nothing. Going through the delegates is the path the app takes.
      expect(loaded.homeDateLine(DateTime(2026, 4, 27)), 'Monday · 27 April');
    });

    testWidgets('the error view words a timeout from the ARB', (tester) async {
      await tester.pumpWidget(
        app(const AppErrorView(failure: ApiFailure(kind: FailureKind.timeout))),
      );
      expect(find.text(text.errorTimeout), findsOneWidget);
    });

    testWidgets('the snack bar words a failed sign-in from the ARB', (tester) async {
      await tester.pumpWidget(app(const SizedBox.shrink()));
      AppNavigator.instance.showFailure(const ApiFailure.signIn());
      await tester.pump();
      expect(find.text(text.errorSignIn), findsOneWidget);
    });
  });
}
