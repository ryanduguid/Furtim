import { afterEach, describe, expect, test } from '@jest/globals';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const bash = process.platform === 'win32'
  ? join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
  : 'bash';
let fixture;

afterEach(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true });
  fixture = undefined;
});

async function runVersionStep(input, ref = 'refs/tags/v1.2.3') {
  const workflow = await readFile(new URL('../../.github/workflows/docker.yml', import.meta.url), 'utf8');
  const step = workflow.split('      - name: Set version')[1].split('\n      - ')[0];
  const body = step.split('        run: |')[1]
    .split(/\r?\n/).filter(line => line.startsWith('          '))
    .map(line => line.slice(10)).join('\n');
  expect(body).not.toContain('${{');
  fixture = await mkdtemp(join(tmpdir(), 'camofox-docker-version-'));
  await writeFile(join(fixture, 'version.sh'), body);
  await writeFile(join(fixture, 'github-env'), '');
  return execFile(bash, ['--noprofile', '--norc', '-eo', 'pipefail', 'version.sh'], {
    cwd: fixture,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      INPUT_VERSION: input,
      GITHUB_REF: ref,
      GITHUB_ENV: 'github-env',
    },
  });
}

describe('Docker workflow version input', () => {
  test.each(['1.2.3', '1.2.3-rc.1', 'release_candidate', 'a'.repeat(128)])(
    'preserves the valid manual tag %s', async input => {
      await runVersionStep(input);
      expect(await readFile(join(fixture, 'github-env'), 'utf8')).toBe(`VERSION=${input}\n`);
    },
  );

  test('uses the release tag when no manual version is supplied', async () => {
    await runVersionStep('', 'refs/tags/v2.0.0');
    expect(await readFile(join(fixture, 'github-env'), 'utf8')).toBe('VERSION=2.0.0\n');
  });

  test.each([
    '$(touch injected)',
    '`touch injected`',
    '"; touch injected; #',
    '1.2.3\nINJECTED=true',
    '../latest',
    '-latest',
    'a'.repeat(129),
  ])('rejects an unsafe tag without executing it or writing environment entries: %s', async input => {
    await expect(runVersionStep(input)).rejects.toMatchObject({ code: 1 });
    expect(await readFile(join(fixture, 'github-env'), 'utf8')).toBe('');
    await expect(access(join(fixture, 'injected'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
