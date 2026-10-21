import QRCode from 'qrcode';

/** A QR code drawn as inline SVG on the server — no script, no image request, scannable at any size. */
export async function QrCode({ value, label, size = 168 }: { value: string; label: string; size?: number }) {
  const svg = await QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2a2420', light: '#ffffff' } });
  return (
    <div className="qr" role="img" aria-label={label} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
