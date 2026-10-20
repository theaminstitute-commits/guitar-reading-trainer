/**
 * Writes src/about/licences.json: every third-party part that ships inside the
 * app, with its copyright lines and full licence text, for the About and
 * licences screen. Production npm packages are read from package-lock.json and
 * their own LICENSE files; the fonts and guitar samples are listed by hand.
 *
 * Run after changing dependencies:  node tools/licences.mjs
 * src/about/licences.test.ts fails if the lock file and this list drift apart.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

/** What each package does in the app, for readers who do not know npm names. */
const ROLE = {
  react: 'User interface',
  'react-dom': 'User interface',
  scheduler: 'User interface (part of React)',
  tone: 'Audio engine',
  'standardized-audio-context': 'Audio engine (part of Tone.js)',
  'automation-events': 'Audio engine (part of Tone.js)',
  '@babel/runtime': 'Support code used by the audio engine',
  tslib: 'Support code used by the audio engine',
  vexflow: 'Music notation drawing',
};

function licenceFile(dir) {
  const name = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!name) throw new Error(`No licence file in ${dir}`);
  return readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim();
}

const packages = Object.entries(lock.packages)
  .filter(([path, info]) => path.startsWith('node_modules/') && !info.dev && !info.devOptional)
  .map(([path, info]) => {
    const name = path.slice('node_modules/'.length);
    const dir = join(root, path);
    if (!existsSync(dir)) throw new Error(`${name} is not installed; run npm install first`);
    const text = licenceFile(dir);
    const copyright = text.split('\n').filter((l) => /^\s*copyright/i.test(l)).map((l) => l.trim());
    if (!ROLE[name]) throw new Error(`Describe what ${name} does in ROLE before shipping it`);
    return { id: name, name, version: info.version, role: ROLE[name], licence: info.license, copyright, text };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const ofl = readFileSync(join(root, 'src/about/ofl-1.1.txt'), 'utf8').replace(/\r\n/g, '\n').trim();

const assets = [
  {
    id: 'font-bravura',
    name: 'Bravura',
    version: '1.392',
    role: 'Music font (notes, clefs, accidentals)',
    licence: 'OFL-1.1',
    copyright: ['Copyright © 2021, Steinberg Media Technologies GmbH (http://www.steinberg.net/), with Reserved Font Name "Bravura".'],
    text: ofl,
  },
  {
    id: 'font-academico',
    name: 'Academico',
    version: '0.902',
    role: 'Music text font (time signatures, labels)',
    licence: 'OFL-1.1',
    copyright: ['Copyright © 2022, Steinberg Media Technologies GmbH (http://www.steinberg.net/), with Reserved Font Name "Academico".'],
    text: ofl,
  },
  {
    id: 'samples-fluidr3',
    name: 'FluidR3_GM acoustic steel guitar samples',
    version: 'midi-js-soundfonts',
    role: 'Guitar sound',
    licence: 'CC-BY-3.0',
    copyright: ['FluidR3_GM soundfont by Frank Wen.', 'MP3 rendering by Benjamin Gleitzman (midi-js-soundfonts, https://github.com/gleitz/midi-js-soundfonts).'],
    text:
      'Licensed under the Creative Commons Attribution 3.0 licence: https://creativecommons.org/licenses/by/3.0/us/\n\n' +
      'Only the notes the app needs are included, unchanged; the app pitch-shifts between them while playing.',
  },
];

const out = join(root, 'src/about/licences.json');
writeFileSync(out, JSON.stringify({ packages, assets }, null, 2) + '\n');
console.log(`Wrote ${out}: ${packages.length} packages, ${assets.length} fonts and sounds`);
