import { describe, expect, it } from 'vitest';
import lockFile from '../../package-lock.json';
import notices from './licences.json';

const lock = lockFile as unknown as {
  packages: Record<string, { version?: string; dev?: boolean; devOptional?: boolean }>;
};

describe('About and licences notices', () => {
  it('list exactly the production packages in the lock file, at their locked versions', () => {
    const shipped = Object.entries(lock.packages)
      .filter(([path, info]) => path.startsWith('node_modules/') && !info.dev && !info.devOptional)
      .map(([path, info]) => `${path.slice('node_modules/'.length)}@${info.version}`)
      .sort();
    // If this fails, a dependency changed: run `node tools/licences.mjs` and check the new entry.
    expect(notices.packages.map((p) => `${p.name}@${p.version}`).sort()).toEqual(shipped);
  });

  it('carry a copyright line and full licence text for every part', () => {
    for (const part of [...notices.packages, ...notices.assets]) {
      expect(part.text.length, part.name).toBeGreaterThan(100);
      if (part.licence !== '0BSD') expect(part.copyright.length, part.name).toBeGreaterThan(0);
    }
    expect(notices.assets.map((a) => a.id)).toEqual(['font-bravura', 'font-academico', 'samples-fluidr3']);
  });
});
