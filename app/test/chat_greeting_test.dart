// The line an empty chat opens with: "Hari Bol <first name>, …" in the reader's
// reading language, "Hari Bol, …" when the account has no name, and the first
// name taken from the name the person gave and never from their email.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/format/chat_greeting.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/app_user.dart';

void main() {
  group('chatGreeting', () {
    test('opens with Hari Bol and the first name', () {
      expect(chatGreeting(const ['en'], 'Asha'), 'Hari Bol Asha, how is your heart today?');
    });

    test('is Hari Bol alone when there is no name to use', () {
      const plain = 'Hari Bol, how is your heart today?';

      expect(chatGreeting(const ['en'], null), plain);
      expect(chatGreeting(const ['en'], ''), plain);
      expect(chatGreeting(const ['en'], '   '), plain);
    });

    test('trims the name it is given', () {
      expect(chatGreeting(const ['en'], '  Asha '), 'Hari Bol Asha, how is your heart today?');
    });

    test('is written in the first language of the reading chain the app has words for', () {
      final hindi = lookupAppLocalizations(const Locale('hi'));

      expect(chatGreeting(const ['hi', 'en'], 'Asha'), hindi.chatGreetingNamed('Asha'));
      expect(chatGreeting(const ['hi', 'en'], null), hindi.chatGreeting);
      // A code the app has no words for is stepped over, not shown in English.
      expect(chatGreeting(const ['zz', 'hi', 'en'], 'Asha'), hindi.chatGreetingNamed('Asha'));
      expect(chatGreeting(const ['hi', 'en'], 'Asha'), isNot(chatGreeting(const ['en'], 'Asha')));
    });

    test('falls back to English when nothing in the chain is a language the app has', () {
      expect(chatGreeting(const [], 'Asha'), 'Hari Bol Asha, how is your heart today?');
      expect(chatGreeting(const ['zz', 'yy'], null), 'Hari Bol, how is your heart today?');
    });

    test('a Sanskrit reader, who has no screen text of their own, gets the next language along', () {
      expect(chatGreeting(const ['sa', 'hi', 'en'], 'Asha'), lookupAppLocalizations(const Locale('hi')).chatGreetingNamed('Asha'));
    });

    test('every language the app speaks has both lines, with the name only in the named one', () {
      for (final locale in AppLocalizations.supportedLocales) {
        final code = locale.languageCode;
        final named = chatGreeting([code], 'Asha');
        final plain = chatGreeting([code], null);

        expect(named, contains('Asha'), reason: '$code names the reader');
        expect(plain, isNotEmpty, reason: '$code has a plain greeting');
        expect(plain, isNot(contains('Asha')), reason: '$code leaves the name out when there is none');
        expect(named, isNot(contains('{')), reason: '$code filled in the placeholder');
        if (code == 'en') {
          expect(named, startsWith('Hari Bol'));
        } else {
          // Opens in the language's own script, not in the Latin letters of English.
          expect(named.codeUnitAt(0), greaterThan(0x7F), reason: '$code opens in its own script');
          expect(named, isNot(chatGreeting(const ['en'], 'Asha')), reason: '$code is not the English line');
        }
      }
    });
  });

  group('AppUser.greetingName', () {
    AppUser user({String? name, String email = 'asha42@smoke.test'}) =>
        AppUser.fromJson({'id': 'usr_1', 'email': email, 'name': name});

    test('is the first word of the name the person gave', () {
      expect(user(name: 'Asha Devi').greetingName, 'Asha');
      expect(user(name: '  Asha   Devi  ').greetingName, 'Asha');
      expect(user(name: 'Asha').greetingName, 'Asha');
    });

    test('is null when there is no name, rather than the start of the email', () {
      expect(user(name: null).greetingName, isNull);
      expect(user(name: '').greetingName, isNull);
      expect(user(name: '   ').greetingName, isNull);
      // `firstName` borrows the email's start for other screens; the greeting must not.
      expect(user(name: null).firstName, 'asha42');
    });
  });
}
