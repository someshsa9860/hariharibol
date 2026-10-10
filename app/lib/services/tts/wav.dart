import 'dart:typed_data';

/// 16-bit mono PCM from float samples in -1…1, clipped rather than wrapped.
Int16List floatToPcm16(Float32List samples) {
  final out = Int16List(samples.length);
  for (var i = 0; i < samples.length; i++) {
    final v = samples[i];
    out[i] = v >= 1 ? 32767 : (v <= -1 ? -32768 : (v * 32767).round());
  }
  return out;
}

/// A complete WAV file (RIFF header + PCM) so a player that only opens files
/// can play synthesised speech.
Uint8List pcm16ToWav(Int16List pcm, int sampleRate) {
  final dataBytes = pcm.length * 2;
  final bytes = BytesBuilder(copy: false);
  final header = ByteData(44);
  void ascii(int offset, String s) {
    for (var i = 0; i < s.length; i++) {
      header.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  ascii(0, 'RIFF');
  header.setUint32(4, 36 + dataBytes, Endian.little);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  header.setUint32(16, 16, Endian.little); // fmt chunk size
  header.setUint16(20, 1, Endian.little); // PCM
  header.setUint16(22, 1, Endian.little); // mono
  header.setUint32(24, sampleRate, Endian.little);
  header.setUint32(28, sampleRate * 2, Endian.little); // byte rate
  header.setUint16(32, 2, Endian.little); // block align
  header.setUint16(34, 16, Endian.little); // bits
  ascii(36, 'data');
  header.setUint32(40, dataBytes, Endian.little);

  bytes.add(header.buffer.asUint8List());
  final body = Uint8List(dataBytes);
  final view = ByteData.sublistView(body);
  for (var i = 0; i < pcm.length; i++) {
    view.setInt16(i * 2, pcm[i], Endian.little);
  }
  bytes.add(body);
  return bytes.takeBytes();
}
