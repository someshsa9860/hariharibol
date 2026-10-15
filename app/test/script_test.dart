import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/format/script.dart';

void main() {
  test('the same script is the same, whatever the language', () {
    expect(sameScript('धर्मक्षेत्रे कुरुक्षेत्रे', 'श्लोकः'), isTrue);
    expect(sameScript('dharmakṣetre kurukṣetre', 'Dharma'), isTrue, reason: 'IAST letters are Latin');
    expect(sameScript('ধর্মক্ষেত্রে', 'কুরুক্ষেত্রে'), isTrue);
  });

  test('different scripts are different', () {
    expect(sameScript('dharmakṣetre', 'धर्मक्षेत्रे'), isFalse);
    expect(sameScript('தர்மக்ஷேத்ரே', 'धर्मक्षेत्रे'), isFalse);
    expect(sameScript('ধর্মক্ষেত্রে', 'धर्मक्षेत्रे'), isFalse, reason: 'Bengali is not Devanagari');
    expect(sameScript('ధర్మక్షేత్రే', 'ಧರ್ಮಕ್ಷೇತ್ರೇ'), isFalse, reason: 'Telugu is not Kannada');
  });

  test('digits, spaces and dandas at the start do not decide the script', () {
    expect(sameScript('॥ १.१ ॥ धर्म', 'धर्मक्षेत्रे'), isTrue);
    expect(sameScript('1.1 dharma', 'धर्मक्षेत्रे'), isFalse);
  });

  test('text with no letters is in no script', () {
    expect(sameScript('', 'धर्म'), isFalse);
    expect(sameScript('॥ ॥', '॥ ॥'), isFalse);
  });
}
