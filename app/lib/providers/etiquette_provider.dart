import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/etiquette.dart';
import '../services/etiquette_service.dart';
import 'language_chain_provider.dart';
import 'saved_then_fresh.dart';

/// Today's etiquette, the saved copy first and then the network's. Watches the
/// reading chain, so choosing another reading language words it again at once.
final etiquetteTodayProvider = StreamProvider.autoDispose<EtiquetteToday>((ref) {
  final languages = ref.watch(readingChainProvider);
  final service = EtiquetteService.instance;
  return savedThenFresh(() => service.savedToday(languages), () => service.today(languages));
});

/// Every published item and the categories that have any. One request: the
/// screen narrows by category on the phone.
final etiquetteListProvider = StreamProvider.autoDispose<EtiquetteList>((ref) {
  final languages = ref.watch(readingChainProvider);
  final service = EtiquetteService.instance;
  return savedThenFresh(() => service.savedList(languages), () => service.list(languages));
});

/// One item in full, by id.
final etiquetteItemProvider = StreamProvider.autoDispose.family<Etiquette, String>((ref, id) {
  final languages = ref.watch(readingChainProvider);
  final service = EtiquetteService.instance;
  return savedThenFresh(() => service.savedItem(id, languages), () => service.item(id, languages));
});
