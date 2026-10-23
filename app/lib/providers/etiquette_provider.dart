import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/etiquette.dart';
import '../services/etiquette_service.dart';
import 'language_chain_provider.dart';

/// Today's etiquette. Watches the reading chain, so choosing another reading
/// language words it again at once.
final etiquetteTodayProvider = FutureProvider.autoDispose<EtiquetteToday>((ref) {
  return EtiquetteService.instance.today(ref.watch(readingChainProvider));
});

/// Every published item and the categories that have any. One request: the
/// screen narrows by category on the phone.
final etiquetteListProvider = FutureProvider.autoDispose<EtiquetteList>((ref) {
  return EtiquetteService.instance.list(ref.watch(readingChainProvider));
});

/// One item in full, by id.
final etiquetteItemProvider = FutureProvider.autoDispose.family<Etiquette, String>((ref, id) {
  return EtiquetteService.instance.item(id, ref.watch(readingChainProvider));
});
