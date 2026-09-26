#!/usr/bin/env node
// Package-level regression test for @askjo/camofox-browser-mcp.
// Packs mcp/, installs that tarball in an empty directory, then runs the same
// MCP handshake smoke test against the installed server. This catches imports
// that accidentally reach outside the published package.

import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MCP_DIR = join(ROOT, 'mcp');
const npmExecutable = process.env.npm_execpath ? process.execPath : 'npm';
const npmArguments = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const testDir = await mkdtemp(join(tmpdir(), 'camofox-browser-mcp-package-'));
let tarball;

try {
  const { stdout } = await execFile(npmExecutable, [...npmArguments, 'pack', '--json'], { cwd: MCP_DIR });
  const [{ filename }] = JSON.parse(stdout);
  tarball = join(MCP_DIR, filename);

  const installDir = join(testDir, 'install');
  await mkdir(installDir);
  await execFile(npmExecutable, [...npmArguments, 'install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: installDir,
  });

  const bin = join(installDir, 'node_modules', '.bin', 'camofox-browser-mcp');
  await access(bin);

  const server = join(installDir, 'node_modules', '@askjo', 'camofox-browser-mcp', 'server.mjs');
  await execFile(process.execPath, [join(ROOT, 'scripts', 'test-mcp.mjs')], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '',
      CAMOFOX_BASE_URL: 'http://localhost:1',
      CAMOFOX_MCP_SERVER: server,
    },
  });
  console.log('packed @askjo/camofox-browser-mcp smoke test passed');
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(testDir, { recursive: true, force: true });
}
