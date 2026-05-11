// Last auto-updated: 2026-05-10
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/config/flavors.dart';
import 'core/storage/hive_storage.dart';
import 'features/settings/presentation/providers/settings_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive
  await HiveStorage.init();
  await initSettingsBox();

  // Set flavor
  F.appFlavor = Flavor.dev;

  runApp(const ProviderScope(child: App()));
}
