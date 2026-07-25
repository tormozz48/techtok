import QRCode from 'qrcode';

/**
 * Renders `text` as an inline SVG string — navy modules on a white
 * background for phone-camera contrast, matching the Orbit palette (D37).
 */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111A33', light: '#FFFFFF' },
  });
}
