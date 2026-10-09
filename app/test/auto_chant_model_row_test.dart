import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/providers/auto_chant_model_provider.dart';
import 'package:hariharibol/services/mantra_accurate_model.dart';
import 'package:hariharibol/widgets/chant/auto_chant_model_row.dart';

/// Stands in for the real download: nothing on disk, and a download the test
/// finishes when it chooses.
class _FakeModel extends MantraAccurateModel {
  _FakeModel({String host = 'https://example.test', this.canRun = true})
      : super(baseUrl: host, folder: () async => Directory.systemTemp);

  final bool canRun;
  bool onDisk = false;
  final finish = Completer<void>();

  @override
  Future<bool> deviceCanRun() async => canRun;

  @override
  Future<AccurateModelFiles?> installed() async => onDisk ? const AccurateModelFiles(model: 'm', tokens: 't') : null;

  @override
  Future<void> download({void Function(double progress)? onProgress, cancelToken}) async {
    onProgress?.call(0.4);
    await finish.future;
    onDisk = true;
  }

  @override
  Future<void> remove() async => onDisk = false;
}

Future<void> _pump(WidgetTester tester, _FakeModel model) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [autoChantModelServiceProvider.overrideWithValue(model)],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(body: AutoChantModelRow()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('nothing is shown when no host is configured', (tester) async {
    await _pump(tester, _FakeModel(host: ''));
    expect(find.byType(TextButton), findsNothing);
    expect(find.text('Sharper listening'), findsNothing);
  });

  testWidgets('nothing is shown on a phone too small to run it', (tester) async {
    await _pump(tester, _FakeModel(canRun: false));
    expect(find.text('Sharper listening'), findsNothing);
  });

  testWidgets('offered, downloading, installed, removed', (tester) async {
    final model = _FakeModel();
    await _pump(tester, model);

    expect(find.text('Sharper listening'), findsOneWidget);
    expect(find.textContaining('MB'), findsOneWidget);

    await tester.tap(find.text('Download'));
    await tester.pump();
    expect(find.text('Downloading… 40%'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);

    model.finish.complete();
    await tester.pumpAndSettle();
    expect(find.textContaining('Downloaded'), findsOneWidget);

    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    // Removed, and with a host and enough memory it is on offer again.
    expect(find.text('Download'), findsOneWidget);
  });
}
