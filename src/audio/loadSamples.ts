/**
 * Decode the guitar samples into AudioBuffers without going through fetch().
 *
 * In the built app the sample URLs are data URIs. Some hosts (the claude.ai
 * artifact page, strict CSP setups) refuse fetch() of data: URLs, which Tone's
 * own loader relies on. Decoding the base64 ourselves avoids the network layer
 * entirely. Plain URLs (the dev server) still go through fetch.
 */
import * as Tone from 'tone';

function bytesFromDataUri(uri: string): ArrayBuffer {
  const comma = uri.indexOf(',');
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (!/;base64$/i.test(header)) {
    throw new Error('Sample data URI is not base64');
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function bytesFromUrl(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sample ${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

export async function loadSampleBuffers(
  sources: Record<string, string>,
): Promise<Record<string, AudioBuffer>> {
  const context = Tone.getContext();
  const entries = await Promise.all(
    Object.entries(sources).map(async ([note, source]) => {
      const bytes = source.startsWith('data:') ? bytesFromDataUri(source) : await bytesFromUrl(source);
      const buffer = await context.decodeAudioData(bytes);
      return [note, buffer] as const;
    }),
  );
  return Object.fromEntries(entries);
}
