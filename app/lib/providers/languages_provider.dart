import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/language.dart';
import '../services/reference_service.dart';

/// Every language the app offers.
///
/// Fetched once and kept: the list is seeded server side and changes about once
/// a release, so re-requesting it each time a picker opens would be waste.
final languagesProvider = FutureProvider<List<Language>>((ref) {
  return ReferenceService.instance.languages();
});

/// The languages valid for one slot, in the order the API sent them.
final languagesForSlotProvider =
    Provider.family<List<Language>, LanguageSlot>((ref, slot) {
  final all = ref.watch(languagesProvider).value ?? const <Language>[];
  return all.where((language) => language.allows(slot)).toList();
});
