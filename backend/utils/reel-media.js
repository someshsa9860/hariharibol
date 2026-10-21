// Tells what an uploaded file really is from its first bytes, whatever its header claims.

// What the bytes are, not what the header says.
export function sniffImage(bytes) {
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length > 12 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length > 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

// Audio containers: MP3 (ID3 tag or frame sync), MP4/M4A (ftyp), AAC (ADTS sync), WAV (RIFF/WAVE).
export function sniffAudio(bytes) {
  if (bytes.length < 12) return null;
  if (bytes.subarray(0, 3).toString('latin1') === 'ID3') return 'audio/mpeg';
  if (bytes.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4';
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WAVE') return 'audio/wav';
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return null;
}

