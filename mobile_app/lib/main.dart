import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/config/flavors.dart';
import 'core/storage/hive_storage.dart';
import 'features/settings/presentation/providers/settings_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await HiveStorage.init();
  await initSettingsBox();
  await Firebase.initializeApp();

  F.appFlavor = Flavor.dev;

  runApp(const ProviderScope(child: App()));
}
