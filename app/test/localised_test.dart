import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/format/localised.dart';
import 'package:hariharibol/models/book.dart';

void main() {
  group('parseLocalised', () {
    test('reads a map from the API', () {
      expect(parseLocalised({'hi': 'गीता', 'ta': 'கீதை'}), {'hi': 'गीता', 'ta': 'கீதை'});
    });

    test('reads the JSON text of a database column', () {
      expect(parseLocalised('{"hi":"गीता"}'), {'hi': 'गीता'});
    });

    test('a missing, malformed or odd value is an empty map, never an error', () {
      expect(parseLocalised(null), isEmpty);
      expect(parseLocalised('not json'), isEmpty);
      expect(parseLocalised('[1,2]'), isEmpty);
      expect(parseLocalised(42), isEmpty);
    });

    test('blank and non-text entries are left out', () {
      expect(parseLocalised({'hi': '  ', 'mr': '', 'ta': 5, 'te': 'తెలుగు'}), {'te': 'తెలుగు'});
    });

    test('the plain column becomes English unless the map has its own', () {
      expect(parseLocalised({'hi': 'गीता'}, english: 'Gita'), {'hi': 'गीता', 'en': 'Gita'});
      expect(parseLocalised({'en': 'Bhagavad-gita'}, english: 'Gita'), {'en': 'Bhagavad-gita'});
      expect(parseLocalised(null, english: ' '), isEmpty);
    });
  });

  group('pickLocalised', () {
    const titles = {'hi': 'हिन्दी', 'mr': 'मराठी', 'en': 'English'};

    test('takes the first language of the chain that has a text', () {
      expect(pickLocalised('plain', titles, ['mr', 'hi', 'en']), 'मराठी');
      expect(pickLocalised('plain', titles, ['ta', 'hi', 'en']), 'हिन्दी');
    });

    test('stops at English, as the server does', () {
      expect(pickLocalised('plain', {'hi': 'हिन्दी'}, ['en', 'hi']), 'plain');
      expect(pickLocalised('plain', titles, ['en', 'hi']), 'English');
    });

    test('falls back to the plain text when nothing matches', () {
      expect(pickLocalised('plain', const {}, ['hi', 'en']), 'plain');
      expect(pickLocalised('plain', titles, const []), 'plain');
    });
  });

  group('BookSection and Book', () {
    test('a section picks its title and summary again for a new chain', () {
      final chapter = BookSection.fromJson({
        'id': 'c1',
        'number': 1,
        'title': 'Observing the Armies',
        'titleI18n': {'en': 'Observing the Armies', 'hi': 'अर्जुनविषादयोग'},
        'summary': 'English summary',
        'summaryI18n': {'hi': 'हिन्दी सार', 'en': 'English summary'},
        'totalVerses': 47,
      });

      expect(chapter.titleFor(['hi', 'en']), 'अर्जुनविषादयोग');
      expect(chapter.titleFor(['en', 'hi']), 'Observing the Armies');
      expect(chapter.titleFor(['ta', 'en']), 'Observing the Armies');
      expect(chapter.summaryFor(['hi', 'en']), 'हिन्दी सार');
    });

    test('a section from an older server, with no maps, shows the title it was sent', () {
      final chapter = BookSection.fromJson({'id': 'c1', 'number': 2, 'title': 'Sankhya-yoga'});

      expect(chapter.titleI18n, isEmpty);
      expect(chapter.titleFor(['hi', 'en']), 'Sankhya-yoga');
      expect(chapter.summaryFor(['hi', 'en']), isNull);
    });

    test('a book picks its title and description again for a new chain', () {
      final book = Book.fromJson({
        'id': 'b1',
        'slug': 'bhagavad-gita',
        'title': 'भगवद्गीता',
        'titleI18n': {'en': 'Bhagavad-gita As It Is', 'hi': 'भगवद्गीता'},
        'bookNumber': 1,
        'type': 'SCRIPTURE',
        'description': 'The Song of God',
        'descriptionI18n': {'en': 'The Song of God', 'hi': 'भगवान का गीत'},
      });

      expect(book.titleFor(['en']), 'Bhagavad-gita As It Is', reason: 'the account was Hindi when the title was sent');
      expect(book.titleFor(['hi', 'en']), 'भगवद्गीता');
      expect(book.descriptionFor(['hi', 'en']), 'भगवान का गीत');
      expect(book.descriptionFor(['en']), 'The Song of God');
    });

    test('a book with no description has none in any language', () {
      final book = Book.fromJson({'id': 'b', 'slug': 's', 'title': 'T', 'bookNumber': 3, 'type': 'STOTRA'});
      expect(book.descriptionFor(['hi', 'en']), isNull);
    });
  });
}
