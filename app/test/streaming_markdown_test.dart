// streamingSafeMarkdown: half-written markdown closed for display, so raw
// marks never flash while a reply is arriving. It must also leave alone every
// mark that is not emphasis.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/format/streaming_markdown.dart';

void main() {
  group('code fences', () {
    test('an unclosed fence is closed on its own line', () {
      expect(streamingSafeMarkdown('Try:\n```dart\nvar x = 1;'), 'Try:\n```dart\nvar x = 1;\n```');
    });

    test('a fence that ends on a newline is closed without a blank line', () {
      expect(streamingSafeMarkdown('```\ncode\n'), '```\ncode\n```');
    });

    test('a tilde fence is closed with tildes, a long fence with as many', () {
      expect(streamingSafeMarkdown('~~~\ncode'), '~~~\ncode\n~~~');
      expect(streamingSafeMarkdown('````\ncode'), '````\ncode\n````');
    });

    test('a closed fence is left alone', () {
      const done = 'a\n```\ncode\n```\nb';
      expect(streamingSafeMarkdown(done), done);
    });

    test('emphasis marks inside an open code block are not touched', () {
      expect(streamingSafeMarkdown('```\na ** b * c'), '```\na ** b * c\n```');
    });

    test('a fence with nothing in it yet is held back, not drawn as an empty box', () {
      expect(streamingSafeMarkdown('Here:\n\n```'), 'Here:\n\n');
      expect(streamingSafeMarkdown('Here:\n\n```dart'), 'Here:\n\n');
      expect(streamingSafeMarkdown('Here:\n\n```dart\nx'), 'Here:\n\n```dart\nx\n```');
    });

    test('only the fence that is open is closed when two blocks came before', () {
      const text = '```\none\n```\n\n```\ntwo';
      expect(streamingSafeMarkdown(text), '$text\n```');
    });
  });

  group('emphasis', () {
    test('open bold is closed', () => expect(streamingSafeMarkdown('Hello **wor'), 'Hello **wor**'));
    test('open italic is closed', () {
      expect(streamingSafeMarkdown('a *slow'), 'a *slow*');
      expect(streamingSafeMarkdown('a _slow'), 'a _slow_');
    });
    test('open underscore bold is closed', () => expect(streamingSafeMarkdown('a __bold'), 'a __bold__'));
    test('open inline code is closed', () => expect(streamingSafeMarkdown('run `ls -l'), 'run `ls -l`'));
    test('bold-italic is closed whole', () => expect(streamingSafeMarkdown('***both'), '***both***'));

    test('nested marks are closed innermost first', () {
      expect(streamingSafeMarkdown('**bold and *ital'), '**bold and *ital***');
    });

    test('balanced marks are left alone', () {
      const text = 'a **b** and *c* and `d`';
      expect(streamingSafeMarkdown(text), text);
    });

    test('a mark with nothing after it yet is dropped, not shown raw', () {
      expect(streamingSafeMarkdown('Hello **'), 'Hello ');
      expect(streamingSafeMarkdown('Hello *'), 'Hello ');
    });

    test('closing a bold across a soft line break in one paragraph', () {
      expect(streamingSafeMarkdown('**a\nb'), '**a\nb**');
    });

    test('only the last paragraph is looked at', () {
      expect(streamingSafeMarkdown('first **unclosed\n\nsecond *x'), 'first **unclosed\n\nsecond *x*');
    });

    test('Devanagari inside bold is closed like any text', () {
      expect(streamingSafeMarkdown('**हरे कृष्ण'), '**हरे कृष्ण**');
    });
  });

  group('marks that are not emphasis', () {
    for (final text in [
      'snake_case_name here',
      'two * three',
      '2 * 3 * 4',
      '* a bullet',
      '- one\n* two\n* three',
      r'an escaped \* star',
      'a_b and c_d',
      'plain text',
      '',
    ]) {
      test('"$text" is unchanged', () => expect(streamingSafeMarkdown(text), text));
    }

    test('a bullet list with bold items stays balanced', () {
      const text = '* **One:** first\n* **Two:** second';
      expect(streamingSafeMarkdown(text), text);
    });
  });

  group('links and images', () {
    test('an image whose address is still arriving is dropped', () {
      expect(streamingSafeMarkdown('See ![a diagram](https://exa'), 'See ');
      expect(streamingSafeMarkdown('See ![a diag'), 'See ');
    });

    test('a finished image is kept', () {
      const text = 'See ![a](https://example.com/a.png) now';
      expect(streamingSafeMarkdown(text), text);
    });

    test('a link whose address is unfinished is closed', () {
      expect(streamingSafeMarkdown('Read [the verse](https://exa'), 'Read [the verse](https://exa)');
    });

    test('a finished link is kept', () {
      const text = 'Read [the verse](https://example.com) now';
      expect(streamingSafeMarkdown(text), text);
    });
  });

  test('a reply being written one character at a time never shows a raw mark', () {
    const full = 'Here is **bold text**, some *italic*, `code` and\n\n```\nblock\n```\n\ndone.';
    for (var end = 1; end <= full.length; end++) {
      final shown = streamingSafeMarkdown(full.substring(0, end));
      // Every fence and every emphasis mark in what is shown has its partner.
      expect(RegExp(r'^```', multiLine: true).allMatches(shown).length.isEven, isTrue, reason: shown);
      final text = shown.replaceAll(RegExp(r'```[\s\S]*?```'), '');
      expect('**'.allMatches(text).length.isEven, isTrue, reason: shown);
      expect('`'.allMatches(text).length.isEven, isTrue, reason: shown);
    }
  });
}
