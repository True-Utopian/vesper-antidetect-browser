import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { payloadLock, installPayloadDependencies } from '../../../scripts/payload-dependencies.mjs';

test('production lock uses source resolutions and discards stale local package snapshots', () => {
  const original = { lockfileVersion: 3, packages: { '': { devDependencies: { obsolete: '1' }, workspaces: ['packages/vesper-browser'] }, 'packages/vesper-browser': { version: 'old' }, 'node_modules/@true-utopian/vesper-browser': { version: 'old' }, 'node_modules/@true-utopian/vesper-browser/node_modules/stale': { version: 'old' }, 'node_modules/maintained': { version: 'patched' } } };
  const metadata = { name: '@true-utopian/vesper-workbench', version: '1.0.0', license: 'MIT', dependencies: { '@true-utopian/vesper-browser': 'file:packages/vesper-browser' } };
  const seed = payloadLock(original, metadata);
  assert.equal(seed.packages['node_modules/maintained'].version, 'patched');
  assert.equal(seed.packages['node_modules/@true-utopian/vesper-browser'], undefined);
  assert.equal(seed.packages['node_modules/@true-utopian/vesper-browser/node_modules/stale'], undefined);
  assert.equal(seed.packages[''].devDependencies, undefined); assert.equal(seed.packages[''].workspaces, undefined);
  assert.equal(original.packages['node_modules/@true-utopian/vesper-browser'].version, 'old');
});
test('reused payload installs changed local package bytes even without a version bump', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-payload-dependency-')), payload = join(root, 'payload'), source = join(payload, 'packages/vesper-browser');
  try {
    await mkdir(join(source, 'dist'), { recursive: true });
    await writeFile(join(source, 'package.json'), JSON.stringify({ name: '@true-utopian/vesper-browser', version: '1.0.0', files: ['dist'], exports: './dist/index.js' }));
    await writeFile(join(root, 'package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } }));
    const metadata = { name: '@true-utopian/vesper-workbench', version: '1.0.0', private: true, license: 'MIT', dependencies: { '@true-utopian/vesper-browser': 'file:packages/vesper-browser' } };
    const originalCache = process.env.npm_config_cache;
    for (const revision of ['first', 'changed-same-version']) {
      await writeFile(join(source, 'dist/index.js'), 'module.exports = ' + JSON.stringify(revision));
      await installPayloadDependencies({ root, payload, metadata, npmCache: join(root, 'npm-cache') });
      assert.equal(process.env.npm_config_cache, originalCache, 'The fixture must not change the caller cache configuration');
      assert.equal(await readFile(join(payload, 'node_modules/@true-utopian/vesper-browser/dist/index.js'), 'utf8'), 'module.exports = ' + JSON.stringify(revision));
      const lock = JSON.parse(await readFile(join(payload, 'package-lock.json'), 'utf8'));
      assert.equal(lock.packages['node_modules/@true-utopian/vesper-browser'].link, undefined);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
