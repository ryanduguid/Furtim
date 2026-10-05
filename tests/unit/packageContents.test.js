/**
 * The published package must contain every file its consumer-facing commands run.
 * fetch-bin once pointed at a script the `files` allowlist left out, so the
 * documented recovery command failed with MODULE_NOT_FOUND after install.
 */
import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function packedFiles() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  expect(result.status).toBe(0);
  const [{ files }] = JSON.parse(result.stdout);
  return new Set(files.map((f) => normalize(f.path)));
}

const nodeTarget = (command) => command.match(/^node\s+(\S+)/)?.[1];

describe('published package contents', () => {
  test('includes the files run by bin, postinstall and fetch-bin', () => {
    const files = packedFiles();
    const required = [
      ...Object.values(pkg.bin),
      nodeTarget(pkg.scripts.postinstall),
      nodeTarget(pkg.scripts['fetch-bin']),
    ];
    for (const target of required) {
      expect(target).toBeTruthy();
      expect([...files]).toContain(normalize(target));
    }
  });
});
