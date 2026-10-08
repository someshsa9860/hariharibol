import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/models/search_result.dart';
import 'package:hariharibol/models/subscription.dart';
import 'package:hariharibol/models/verse.dart';

void main() {
  group('AppUser.sampradaya', () {
    const base = {'id': 'u1', 'email': 'a@example.com', 'timezone': 'Asia/Kolkata'};

    test('is the tradition the API sends', () {
      expect(AppUser.fromJson({...base, 'sampradaya': 'shaiva'}).sampradaya, 'shaiva');
    });

    test('is null while there is not enough chanting to say, or when the API says nothing', () {
      expect(AppUser.fromJson({...base, 'sampradaya': null}).sampradaya, isNull);
      expect(AppUser.fromJson(base).sampradaya, isNull);
    });

    test('survives being stored and read back, and a copy with other changes', () {
      final user = AppUser.fromJson({...base, 'sampradaya': 'vaishnav'});
      expect(AppUser.fromJson(user.toJson()).sampradaya, 'vaishnav');
      expect(user.copyWith(name: 'Asha').sampradaya, 'vaishnav');
    });
  });

  group('Mantra mala recording', () {
    const base = {'id': 'm1', 'slug': 'mahamantra', 'name': 'Mahamantra', 'text': 'हरे कृष्ण'};

    test('is followed when the API sends a link and the stretch of chanting', () {
      final mantra = Mantra.fromJson({
        ...base,
        'malaAudioUrl': 'https://media.example/mala.mp3',
        'malaAudioStartMs': 15500,
        'malaAudioEndMs': 430000,
      });
      expect(mantra.hasMalaAudio, isTrue);
      expect(mantra.malaAudioStartMs, 15500);
      expect(mantra.malaAudioEndMs, 430000);
    });

    test('is absent when the API sends three nulls, or nothing at all', () {
      final nulls = Mantra.fromJson({
        ...base,
        'malaAudioUrl': null,
        'malaAudioStartMs': null,
        'malaAudioEndMs': null,
      });
      expect(nulls.hasMalaAudio, isFalse);
      expect(Mantra.fromJson(base).hasMalaAudio, isFalse);
    });

    test('is not followed when there is no stretch to count over', () {
      final empty = Mantra.fromJson({
        ...base,
        'malaAudioUrl': 'https://media.example/mala.mp3',
        'malaAudioStartMs': 9000,
        'malaAudioEndMs': 9000,
      });
      expect(empty.hasMalaAudio, isFalse);
    });
  });

  group('SadhanaDay', () {
    test('reports no progress when no target is set', () {
      const day = SadhanaDay(roundTarget: 0, roundsCompleted: 4, tasksTotal: 0, tasksDone: 0);
      expect(day.roundProgress, 0);
      expect(day.roundTargetMet, isFalse);
    });

    test('clamps progress once the target is passed', () {
      const day = SadhanaDay(roundTarget: 16, roundsCompleted: 20, tasksTotal: 3, tasksDone: 1);
      expect(day.roundProgress, 1);
      expect(day.roundTargetMet, isTrue);
      expect(day.taskProgress, closeTo(0.333, 0.001));
    });
  });

  group('Verse.reference', () {
    test('numbers a Gita verse without a canto', () {
      final verse = Verse.fromJson({
        'id': 'v1',
        'verseId': '1.2.13',
        'bookNumber': 1,
        'chapterNumber': 2,
        'verseNumber': 13,
        'book': {'id': 'b1', 'slug': 'bhagavad-gita', 'title': 'Bhagavad Gita', 'bookNumber': 1},
      });
      expect(verse.reference, 'Bhagavad Gita 2.13');
    });

    test('keeps a Bhagavatam range together', () {
      final verse = Verse.fromJson({
        'id': 'v2',
        'verseId': '2.10.1.5-7',
        'bookNumber': 2,
        'cantoNumber': 10,
        'chapterNumber': 1,
        'verseNumber': 5,
        'verseNumberEnd': 7,
        'book': {'id': 'b2', 'slug': 'srimad-bhagavatam', 'title': 'Srimad Bhagavatam', 'bookNumber': 2},
      });
      expect(verse.reference, 'Srimad Bhagavatam 10.1.5-7');
    });
  });

  group('SearchOverview.fromJson', () {
    test('reads each kind and its hasMore flag independently', () {
      final overview = SearchOverview.fromJson({
        'query': 'krishna',
        'verses': [],
        'verseHasMore': false,
        'mantras': [
          {'id': 'm1', 'slug': 'hare-krishna', 'name': 'Hare Krishna', 'text': 'Hare Krishna'},
        ],
        'mantraHasMore': true,
        'books': [],
        'bookHasMore': false,
      });

      expect(overview.query, 'krishna');
      expect(overview.verses, isEmpty);
      expect(overview.mantras, hasLength(1));
      expect(overview.mantraHasMore, isTrue);
      expect(overview.bookHasMore, isFalse);
      expect(overview.isEmpty, isFalse);
    });

    test('is empty only when all three kinds are', () {
      final overview = SearchOverview.fromJson({'query': 'xyzzy'});
      expect(overview.isEmpty, isTrue);
    });
  });

  group('Entitlement', () {
    test('reads the plan, its features and a limit', () {
      final entitlement = Entitlement.fromJson({
        'isPremium': true,
        'reason': 'SUBSCRIPTION',
        'plan': {'id': 'p', 'slug': 'premium', 'name': 'Premium', 'tier': 1, 'isFree': false},
        'features': {
          'ads.removed': {'enabled': true, 'limit': null},
          'downloads.offline': {'enabled': true, 'limit': 5},
        },
      });

      expect(entitlement.plan?.name, 'Premium');
      expect(entitlement.can('ads.removed'), isTrue);
      expect(entitlement.limitOf('downloads.offline'), 5);
      expect(entitlement.limitOf('ads.removed'), isNull);
    });

    test('a feature it has never heard of is off', () {
      expect(Entitlement.none.can('something.new'), isFalse);
    });
  });

  group('PlanCatalog', () {
    test('keeps a price per provider', () {
      final catalog = PlanCatalog.fromJson({
        'features': [
          {'key': 'ads.removed', 'name': 'Ad-free', 'kind': 'FLAG'},
        ],
        'plans': [
          {
            'id': 'f', 'slug': 'free', 'name': 'Free', 'tier': 0, 'isFree': true,
            'prices': [], 'features': {'ads.removed': {'enabled': false}},
          },
          {
            'id': 'p', 'slug': 'premium', 'name': 'Premium', 'tier': 1, 'isFree': false,
            'prices': [
              {'id': 'a', 'provider': 'GOOGLE_PLAY', 'productId': 'g', 'priceMinor': 19900, 'currency': 'INR', 'periodDays': 30, 'trialDays': 7},
              {'id': 'b', 'provider': 'APPLE_APP_STORE', 'productId': 'a', 'priceMinor': 24900, 'currency': 'INR', 'periodDays': 30, 'trialDays': 0},
            ],
            'features': {'ads.removed': {'enabled': true}},
          },
        ],
      });

      expect(catalog.plans.first.isFree, isTrue);
      expect(catalog.plans.first.prices, isEmpty);
      final premium = catalog.plans.last;
      expect(premium.prices.map((p) => p.priceMinor), [19900, 24900]);
      expect(premium.prices.first.hasTrial, isTrue);
      expect(premium.prices.last.hasTrial, isFalse);
      expect(catalog.features.single.isLimit, isFalse);
    });
  });
}
