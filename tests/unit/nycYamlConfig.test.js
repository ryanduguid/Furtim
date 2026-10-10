import { describe, test, expect } from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadNycConfig } = require('@istanbuljs/load-nyc-config');

async function withConfig(yaml, run) {
  const cwd = await mkdtemp(join(tmpdir(), 'furtim-nyc-'));
  try {
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ nyc: { all: false, lines: 70 } }));
    await writeFile(join(cwd, '.nycrc.yml'), yaml);
    await writeFile(join(cwd, 'base.yml'), 'branches: 80\n');
    return await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('the Jest coverage configuration loader', () => {
  test('preserves YAML merges, arrays, extensions and package defaults', async () => {
    await withConfig(`defaults: &defaults
  all: true
  include: ["lib/**/*.js"]
<<: *defaults
exclude: ["tests/**"]
extension: .js
check-coverage: true
extends: ./base.yml
`, async (cwd) => {
      const config = await loadNycConfig({ cwd });
      expect(config).toMatchObject({
        cwd, all: true, lines: 70, branches: 80, checkCoverage: true,
        include: ['lib/**/*.js'], exclude: ['tests/**'], extension: ['.js'],
        defaults: { all: true, include: ['lib/**/*.js'] },
      });
      expect(config).not.toHaveProperty('extends');
    });
  });

  test('rejects executable YAML tags', async () => {
    await withConfig('value: !!js/function "function () { return 1; }"\n', async (cwd) => {
      await expect(loadNycConfig({ cwd })).rejects.toThrow();
    });
  });

  test('prototype-sensitive merge input cannot pollute other objects', async () => {
    await withConfig(`defaults: &defaults
  __proto__:
    furtimPolluted: true
<<: *defaults
`, async (cwd) => {
      await loadNycConfig({ cwd });
      expect(Object.prototype).not.toHaveProperty('furtimPolluted');
      expect({}.furtimPolluted).toBeUndefined();
    });
  });
});
