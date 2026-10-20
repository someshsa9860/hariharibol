// "Chant now" on Home and on the Jap tab reads the mantra before it opens the
// counter. The provider it reads is autoDispose, and a plain read does not hold
// it: with nothing saved yet the request is still out when Riverpod lets the
// provider go, the future fails with a Bad state and the button does nothing.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/providers/mantra_provider.dart';
import 'package:hariharibol/widgets/dashboard/open_chant.dart';

const _slug = 'hare-krishna-mahamantra';

const _mantra = Mantra(
  id: 'm',
  slug: _slug,
  name: 'Hare Krishna Mahamantra',
  text: 'हरे कृष्ण',
  textLanguage: 'hi',
);

class _Tap extends ConsumerWidget {
  const _Tap({required this.onLoaded, required this.onError});

  final void Function(Mantra mantra) onLoaded;
  final void Function(Object error) onError;

  @override
  Widget build(BuildContext context, WidgetRef ref) => TextButton(
        onPressed: () => loadMantra(ref, _slug).then(onLoaded, onError: onError),
        child: const Text('chant'),
      );
}

void main() {
  testWidgets('a mantra still being fetched when the button is pressed is waited for', (tester) async {
    final network = Completer<Mantra>();
    Mantra? loaded;
    Object? failed;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Nothing saved: the stream says nothing until the request answers.
          mantraDetailProvider.overrideWith((ref, slug) => Stream.fromFuture(network.future)),
        ],
        child: MaterialApp(
          home: _Tap(onLoaded: (mantra) => loaded = mantra, onError: (error) => failed = error),
        ),
      ),
    );

    await tester.tap(find.text('chant'));
    // Long enough for Riverpod to let go of a provider nothing is listening to.
    await tester.pump(const Duration(milliseconds: 100));
    network.complete(_mantra);
    await tester.pump(const Duration(milliseconds: 100));

    expect(failed, isNull);
    expect(loaded?.slug, _slug);
  });
}
