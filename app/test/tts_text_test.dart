import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/tts_model.dart';
import 'package:hariharibol/services/tts/text_chunker.dart';
import 'package:hariharibol/services/tts/wav.dart';

void main() {
  group('TextChunker', () {
    test('empty and blank text have no chunks', () {
      expect(TextChunker.split(''), isEmpty);
      expect(TextChunker.split('  \n \t '), isEmpty);
    });

    test('short text is one chunk', () {
      expect(TextChunker.split('Hello there.'), ['Hello there.']);
    });

    test('splits at sentence ends, keeping the punctuation', () {
      final text = '${'First sentence is of a reasonable length here. ' * 1}'
          'Second sentence is also long enough to stand by itself ok. '
          'Third sentence follows right after the second one finishes.';
      final chunks = TextChunker.split(text, maxChars: 70, minChars: 20);
      expect(chunks, hasLength(3));
      expect(chunks.every((c) => c.endsWith('.')), isTrue);
    });

    test('Devanagari danda and double danda end sentences', () {
      const text = 'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः। मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय॥ सञ्जय उवाच इति';
      final chunks = TextChunker.split(text, maxChars: 50, minChars: 10);
      expect(chunks.length, greaterThanOrEqualTo(2));
      expect(chunks.first.endsWith('।'), isTrue);
    });

    test('no chunk exceeds the limit, however long the sentence', () {
      final long = List.filled(80, 'word').join(' ');
      final chunks = TextChunker.split(long, maxChars: 100, minChars: 10);
      expect(chunks.every((c) => c.length <= 100), isTrue);
      expect(chunks.join(' '), long, reason: 'nothing lost or reordered');
    });

    test('breaks a long sentence at commas before breaking words', () {
      const text = 'alpha beta gamma, delta epsilon zeta, eta theta iota, kappa lambda mu';
      final chunks = TextChunker.split(text, maxChars: 36, minChars: 5);
      expect(chunks.first, endsWith(','));
      expect(chunks.every((c) => c.length <= 36), isTrue);
    });

    test('an unbroken run with no spaces is cut, not looped on', () {
      final chunks = TextChunker.split('x' * 450, maxChars: 100, minChars: 10);
      expect(chunks.every((c) => c.length <= 100), isTrue);
      expect(chunks.join(), 'x' * 450);
    });

    test('very short sentences are joined to a neighbour', () {
      final chunks = TextChunker.split('Om. Hari. Bol. Krishna Krishna Hare Hare.', maxChars: 100, minChars: 30);
      expect(chunks, hasLength(1));
    });

    test('newlines separate paragraphs', () {
      final chunks = TextChunker.split('One paragraph that is long enough to stay alone here.\nAnother paragraph that is long enough too.', maxChars: 60, minChars: 20);
      expect(chunks, hasLength(2));
    });

    test('the default limits keep a typical purport under the limit', () {
      final purport = List.filled(40, 'The living entity is eternally part of the Lord.').join(' ');
      final chunks = TextChunker.split(purport);
      expect(chunks.length, greaterThan(5));
      expect(chunks.every((c) => c.length <= 220), isTrue);
    });
  });

  group('wav', () {
    test('float samples become 16-bit, clipped not wrapped', () {
      final pcm = floatToPcm16(Float32List.fromList([0, 0.5, -0.5, 1, -1, 2, -3]));
      expect(pcm, [0, 16384, -16384, 32767, -32768, 32767, -32768]);
    });

    test('a WAV file has a valid header and the samples after it', () {
      final wav = pcm16ToWav(Int16List.fromList([1, -2, 3]), 22050);
      final data = ByteData.sublistView(wav);
      expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(wav.sublist(8, 12)), 'WAVE');
      expect(data.getUint32(4, Endian.little), 36 + 6);
      expect(data.getUint32(24, Endian.little), 22050);
      expect(data.getUint16(22, Endian.little), 1);
      expect(data.getUint32(40, Endian.little), 6);
      expect(wav.length, 44 + 6);
      expect(data.getInt16(44, Endian.little), 1);
      expect(data.getInt16(46, Endian.little), -2);
      expect(data.getInt16(48, Endian.little), 3);
    });
  });

  group('TtsModelManifest', () {
    final manifest = TtsModelManifest.fromJson({
      'version': 2,
      'models': [
        {'id': 'a', 'name': 'A', 'languages': ['hi'], 'enabled': false, 'url': '', 'sha256': ''},
        {'id': 'b', 'name': 'B', 'languages': ['hi', 'mr'], 'url': 'https://x/b', 'sizeBytes': 10, 'sha256': 'a' * 64},
        {'id': '', 'name': 'nameless'},
      ],
    });

    test('parses, dropping entries with no id', () {
      expect(manifest.models.map((m) => m.id), ['a', 'b']);
      expect(manifest.version, 2);
    });

    test('an installable voice is preferred over a candidate', () {
      expect(manifest.forLanguage('hi')!.id, 'b');
      expect(manifest.forLanguage('mr')!.id, 'b');
    });

    test('a candidate is returned when nothing is installable, but is not installable', () {
      final only = TtsModelManifest.fromJson({
        'models': [{'id': 'a', 'languages': ['ta'], 'enabled': false}],
      });
      expect(only.forLanguage('ta')!.installable, isFalse);
      expect(only.forLanguage('xx'), isNull);
    });

    test('a voice without a 64-character checksum is never installable', () {
      for (final sha in ['', 'abc', 'g' * 64 == '' ? '' : 'a' * 63]) {
        final spec = TtsModelSpec.fromJson({'id': 'x', 'languages': ['hi'], 'url': 'https://x', 'sha256': sha});
        expect(spec.installable, isFalse, reason: 'sha "$sha"');
      }
      expect(TtsModelSpec.fromJson({'id': 'x', 'languages': ['hi'], 'url': 'https://x', 'sha256': 'A' * 64}).installable, isTrue);
    });

    test('the bundled manifest parses and offers nothing unverified', () {
      final json = jsonDecode(File('assets/tts/tts_models.json').readAsStringSync()) as Map<String, dynamic>;
      final bundled = TtsModelManifest.fromJson(json);
      expect(bundled.models, isNotEmpty);
      expect(bundled.models.where((m) => m.installable), isEmpty,
          reason: 'a voice goes live only once its URL and checksum are confirmed');
      expect(bundled.forLanguage('hi')?.id, 'vits-piper-hi_IN-pratham-medium');
    });
  });
}
