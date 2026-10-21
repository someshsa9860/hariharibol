import QRCode from 'qrcode';

/** A QR code as inline SVG, made on the server so it is there before any script runs. Encodes exactly `value`. */
export async function Qr({ value, label }: { value: string; label: string }) {
  const svg = await QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } });
  return <div role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
