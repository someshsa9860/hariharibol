import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

/// Where the counter gets the player a mala recording plays through — a
/// provider so a test can hand it one with no platform behind it.
final malaAudioPlayerProvider = Provider<AudioPlayer Function()>((ref) => AudioPlayer.new);
