import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/share_links.dart';

// The grammar is the same one `backend/test/share.test.js` and the website check.
void main() {
  const code = 'abcdEFGH23';

  test('reads a content link on the web host, with or without www', () {
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/shloka/$code')), const ContentLink(ShareType.verse, code));
    expect(ShareLinks.parse(Uri.parse('https://www.hariharibol.com/darshan/$code?utm=x')), const ContentLink(ShareType.reel, code));
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/naam/$code')), const ContentLink(ShareType.mantra, code));
  });

  test('reads the custom scheme, including the website\'s open button', () {
    expect(ShareLinks.parse(Uri.parse('hariharibol://shloka/$code')), const ContentLink(ShareType.verse, code));
    expect(ShareLinks.parse(Uri.parse('hariharibol://open?path=/naam/$code')), const ContentLink(ShareType.mantra, code));
    expect(ShareLinks.parse(Uri.parse('hariharibol://satsang/abcd2345')), const InviteLink('ABCD2345'));
  });

  test('an invitation is its own family and its code is case-insensitive', () {
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/satsang/abcd2345')), const InviteLink('ABCD2345'));
    expect(ShareLinks.normaliseInvite(' abcd-2345 '), 'ABCD2345');
    expect(ShareLinks.normaliseInvite('abc'), isNull);
    expect(ShareLinks.normaliseInvite('0OIl0OIl'), isNull);
  });

  test('refuses another host, a look-alike host, a bad code or a foreign path', () {
    expect(ShareLinks.parse(Uri.parse('https://evil.com/shloka/$code')), isNull);
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com.evil.com/shloka/$code')), isNull);
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/shloka/short')), isNull);
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/shloka/0OIl0OIl0')), isNull);
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/verse/1.2.3')), isNull);
    expect(ShareLinks.parse(Uri.parse('https://hariharibol.com/shloka')), isNull);
    expect(ShareLinks.parse(Uri.parse('ftp://hariharibol.com/shloka/$code')), isNull);
    expect(ShareLinks.parse(Uri.parse('hariharibol://open?path=https://evil.com/x')), isNull);
  });

  test('claims only what it can read', () {
    expect(ShareLinks.claims(Uri.parse('/shloka/$code')), isTrue); // how the router sees a link
    expect(ShareLinks.claims(Uri.parse('https://hariharibol.com/shloka/$code')), isTrue);
    expect(ShareLinks.claims(Uri.parse('/home')), isFalse);
  });
}
