import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../services/connection_status.dart';
import '../services/mala_audio_cache.dart';

/// Where the counter gets the player a mala recording plays through — a
/// provider so a test can hand it one with no platform behind it.
final malaAudioPlayerProvider = Provider<AudioPlayer Function()>((ref) => AudioPlayer.new);

/// Where mala recordings are kept to play offline. Null, in a test, keeps
/// nothing.
final malaAudioCacheProvider = Provider<MalaAudioCache?>((ref) => MalaAudioCache.instance);

/// Whether the phone has a connection, for the recording that is hidden while
/// it has none and not kept. Null, in a test, takes it to be online always.
final malaConnectionProvider = Provider<ConnectionStatus?>((ref) => DeviceConnectionStatus());
