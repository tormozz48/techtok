import QRCode from 'qrcode';

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111A33', light: '#FFFFFF' },
  });
}
