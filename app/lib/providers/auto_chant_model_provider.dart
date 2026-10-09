import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auto_chant_log.dart';
import '../services/mantra_accurate_model.dart';

/// Where the optional sharper recogniser is, as the setup sheet shows it.
enum AutoChantModelPhase {
  /// Nothing to offer: no host configured, or a phone too small to run it.
  hidden,
  available,
  downloading,
  installed,
  failed,
}

class AutoChantModelState {
  const AutoChantModelState(this.phase, {this.progress = 0});

  final AutoChantModelPhase phase;

  /// 0–1 while [phase] is downloading.
  final double progress;
}

/// The service behind it — a provider so a test can hand it one with no network
/// and no disk behind it.
final autoChantModelServiceProvider = Provider<MantraAccurateModel>((ref) => MantraAccurateModel());

class AutoChantModelNotifier extends Notifier<AutoChantModelState> {
  CancelToken? _cancel;

  @override
  AutoChantModelState build() {
    unawaited(_refresh());
    return const AutoChantModelState(AutoChantModelPhase.hidden);
  }

  MantraAccurateModel get _service => ref.read(autoChantModelServiceProvider);

  Future<void> _refresh() async {
    if (await _service.installed() != null) {
      state = const AutoChantModelState(AutoChantModelPhase.installed);
    } else if (_service.hasHost && await _service.deviceCanRun()) {
      state = const AutoChantModelState(AutoChantModelPhase.available);
    }
  }

  Future<void> download() async {
    if (state.phase == AutoChantModelPhase.downloading) return;
    final cancel = CancelToken();
    _cancel = cancel;
    state = const AutoChantModelState(AutoChantModelPhase.downloading);
    try {
      await _service.download(
        cancelToken: cancel,
        onProgress: (progress) => state = AutoChantModelState(AutoChantModelPhase.downloading, progress: progress),
      );
      state = const AutoChantModelState(AutoChantModelPhase.installed);
    } catch (error, stack) {
      if (cancel.isCancelled) {
        state = const AutoChantModelState(AutoChantModelPhase.available);
      } else {
        AutoChantLog.error('model: download failed', error, stack);
        state = const AutoChantModelState(AutoChantModelPhase.failed);
      }
    } finally {
      _cancel = null;
    }
  }

  /// Stops a download; what has arrived is kept, so the next one carries on.
  void cancel() => _cancel?.cancel();

  Future<void> remove() async {
    await _service.remove();
    await _refresh();
    if (state.phase == AutoChantModelPhase.installed) state = const AutoChantModelState(AutoChantModelPhase.hidden);
  }
}

final autoChantModelProvider = NotifierProvider<AutoChantModelNotifier, AutoChantModelState>(AutoChantModelNotifier.new);
