// Who is signed in, at the top of Settings. What is guarded here is the line for
// the email: an account that came over from the previous app can have no address
// the reader can use (the API sends none rather than a made-up one), and the
// header must then draw the name alone — not an empty line with a gap above it.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/widgets/settings/identity_header.dart';

AppUser userWith({String email = 'asha@example.com', String? name = 'Asha Devi'}) => AppUser.fromJson({
      'id': 'u1',
      'email': email,
      'name': name,
      'timezone': 'Asia/Kolkata',
    });

Future<void> pump(WidgetTester tester, AppUser user, {Brightness brightness = Brightness.light}) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  return tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
      home: MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.4), size: Size(320, 640)),
        child: Scaffold(
          body: Padding(padding: const EdgeInsets.all(16), child: IdentityHeader(user: user)),
        ),
      ),
    ),
  );
}

void main() {
  for (final brightness in Brightness.values) {
    group('on a narrow phone, ${brightness.name}', () {
      testWidgets('shows the name and the address', (tester) async {
        await pump(tester, userWith(), brightness: brightness);

        expect(find.text('Asha Devi'), findsOneWidget);
        expect(find.text('asha@example.com'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets('shows the name alone when there is no address', (tester) async {
        await pump(tester, userWith(email: ''), brightness: brightness);

        expect(find.text('Asha Devi'), findsOneWidget);
        expect(find.text(''), findsNothing);
        expect(tester.takeException(), isNull);
      });

      testWidgets('the mark is the initials, address or not', (tester) async {
        await pump(tester, userWith(email: ''), brightness: brightness);

        expect(find.text('AD'), findsOneWidget);
      });

      testWidgets('draws something, and does not fail, with neither name nor address', (tester) async {
        await pump(tester, userWith(email: '', name: null), brightness: brightness);

        expect(find.text('?'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    });
  }
}
