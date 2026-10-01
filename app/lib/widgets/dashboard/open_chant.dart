import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../models/api_failure.dart';
import '../../providers/mantra_provider.dart';

/// Opens the counter already carrying [mantraSlug], the same way "chant this"
/// from a mantra's own page does. With no slug it is the generic counter.
///
/// Shared by every "chant now" on the dashboard — the Jap tab's button and the
/// Home tab's sadhana card — so both land on the same screen with the same
/// mantra rather than each fetching it its own way.
Future<void> openChant(WidgetRef ref, {String? mantraSlug}) async {
  final navigator = AppNavigator.instance;
  if (mantraSlug == null) {
    navigator.push(AppRoutes.chant);
    return;
  }

  try {
    final mantra = await navigator.loading.wrap(
      () => ref.read(mantraDetailProvider(mantraSlug).future),
    );
    navigator.push(AppRoutes.chant, extra: mantra);
  } on ApiFailure catch (failure) {
    navigator.showFailure(failure);
  }
}
