/// What the phone last saved, at once, then what the network says.
///
/// This is what lets a screen work with no connection: the saved copy draws
/// it and a failed request leaves it standing — no error is shown over
/// something true. With nothing saved yet (a first launch) the request's own
/// answer, or failure, is all there is. See "Offline" in app/CLAUDE.md.
///
/// The request is started before the saved copy is handed over, so the cache is
/// refreshed even when a reader takes the first value and lets go.
Stream<T> savedThenFresh<T>(T? Function() saved, Future<T> Function() fetch) async* {
  final fresh = fetch()..ignore();
  final copy = saved();

  if (copy == null) {
    yield await fresh;
    return;
  }

  yield copy;
  try {
    yield await fresh;
  } catch (_) {
    // Offline or the server is down: the saved copy stays.
  }
}
