import { expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../scripts/test-mcp-package.mjs', import.meta.url), 'utf8');
const [, selection] = source.match(/const MCP_DIR[^\n]*\n([\s\S]*?)const testDir/);

function selectNpm(platform, env) {
  return runInNewContext(`${selection}\n({ npmExecutable, npmArguments })`, {
    basename,
    process: { platform, env, execPath: '/fixture/node' },
  });
}

test('npm lifecycle runs use the Node executable and npm entry point', () => {
  expect(selectNpm('win32', {
    npm_config_user_agent: 'npm/11.0.0 node/v24.0.0 win32 x64',
    npm_execpath: '/fixture/npm-cli.js',
  })).toEqual({ npmExecutable: '/fixture/node', npmArguments: ['/fixture/npm-cli.js'] });
});

test('npm lifecycle runs accept a customised user-agent setting', () => {
  expect(selectNpm('win32', {
    npm_config_user_agent: 'fixture-client/1.0',
    npm_execpath: '/fixture/npm-cli.js',
  })).toEqual({ npmExecutable: '/fixture/node', npmArguments: ['/fixture/npm-cli.js'] });
});

test('direct Windows runs explain the supported npm command', () => {
  expect(() => selectNpm('win32', {})).toThrow('npm run test:mcp');
});

test('Yarn on Windows cannot receive npm-specific package arguments', () => {
  expect(() => selectNpm('win32', {
    npm_config_user_agent: 'yarn/1.22.22 npm/? node/v24.0.0 win32 x64',
    npm_execpath: '/fixture/yarn.js',
  })).toThrow('npm run test:mcp');
});

test('Yarn on Unix falls back to npm on PATH', () => {
  expect(selectNpm('linux', {
    npm_config_user_agent: 'yarn/1.22.22 npm/? node/v24.0.0 linux x64',
    npm_execpath: '/fixture/yarn.js',
  })).toEqual({ npmExecutable: 'npm', npmArguments: [] });
});
