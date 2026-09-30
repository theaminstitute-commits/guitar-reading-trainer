/**
 * Turn the Vite build in dist/ into one self-contained HTML file
 * (dist/guitar-reading-trainer.html) by inlining the JS and CSS bundles.
 * Audio samples are already data URIs thanks to build.assetsInlineLimit.
 *
 * Usage: node tools/single-file.mjs [outputPath]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = process.argv[2] ? resolve(process.argv[2]) : join(dist, 'guitar-reading-trainer.html');

let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/,
  (_, path) => `<script type="module">${readFileSync(join(dist, path), 'utf8')}</script>`,
);
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/,
  (_, path) => `<style>${readFileSync(join(dist, path), 'utf8')}</style>`,
);
// The single file has no service worker or manifest next to it.
html = html.replace(/<link rel="manifest"[^>]*>/, '');
html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');

if (/src="\.\/assets|href="\.\/assets/.test(html)) {
  throw new Error('Some assets are still referenced externally');
}

writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} kB)`);
