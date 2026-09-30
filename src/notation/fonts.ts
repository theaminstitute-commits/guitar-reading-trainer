/**
 * Load VexFlow's music fonts from binary data rather than URLs.
 *
 * The fonts ship as base64 data URIs. Creating a FontFace from an ArrayBuffer
 * sidesteps Content Security Policy font-src rules that block `url(data:...)`
 * on some hosts. Call `ensureNotationFonts()` before rendering a staff.
 */
import { VexFlow } from 'vexflow/core';
import { Academico } from './vendor/academico';
import { Bravura } from './vendor/bravura';

function bufferFromDataUri(uri: string): ArrayBuffer {
  const payload = uri.slice(uri.indexOf(',') + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let ready: Promise<void> | null = null;

export function ensureNotationFonts(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
        throw new Error('FontFace API is not available');
      }
      const faces = [
        new FontFace('Bravura', bufferFromDataUri(Bravura), { display: 'block' }),
        new FontFace('Academico', bufferFromDataUri(Academico), { display: 'swap' }),
      ];
      await Promise.all(faces.map((f) => f.load()));
      for (const f of faces) document.fonts.add(f);
      VexFlow.setFonts('Bravura', 'Academico');
    })();
  }
  return ready;
}
