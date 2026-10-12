import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extensionLaunchPaths, profileLaunchPath } from '../src/extension-launch.js';

test('short extension launch copies preserve long and comma-containing packages without deleting originals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-alias-test-'));
  const paths = [join(root, 'profile,one', 'a'.repeat(100), 'b'.repeat(100)), join(root, 'profile,two')];
  let launch;
  try {
    for (const [index, path] of paths.entries()) { await mkdir(path, { recursive: true }); await writeFile(join(path, 'manifest.json'), JSON.stringify({ name: 'Owned ' + index })); }
    launch = await extensionLaunchPaths(paths);
    assert.equal(launch.paths.length, 2);
    for (const [index, alias] of launch.paths.entries()) {
      assert.ok(!alias.includes(',')); assert.ok(join(alias, 'manifest.json').length < 240);
      assert.notEqual(await realpath(alias), await realpath(paths[index]));
      assert.equal(JSON.parse(await readFile(join(alias, 'manifest.json'), 'utf8')).name, 'Owned ' + index);
    }
    await launch.cleanup(); await launch.cleanup();
    for (const path of paths) await access(join(path, 'manifest.json'));
    for (const alias of launch.paths) await assert.rejects(access(alias), { code: 'ENOENT' });
  } finally { await launch?.cleanup(); await rm(root, { recursive: true, force: true }); }
});

test('Windows profile storage gets a short junction without moving or deleting persistent data', { skip: process.platform !== 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-profile-path-test-'));
  const directory = join(root, 'profile-' + 'a'.repeat(90)); let launch;
  try {
    await mkdir(directory); await writeFile(join(directory, 'owned.txt'), 'persistent profile');
    launch = await profileLaunchPath(directory); assert.ok(launch.path.length < 140);
    assert.equal(await realpath(launch.path), await realpath(directory));
    await writeFile(join(launch.path, 'new.txt'), 'write through the junction');
    await Promise.all([launch.cleanup(), launch.cleanup()]);
    assert.equal(await readFile(join(directory, 'owned.txt'), 'utf8'), 'persistent profile');
    assert.equal(await readFile(join(directory, 'new.txt'), 'utf8'), 'write through the junction');
    await assert.rejects(access(launch.path), { code: 'ENOENT' });
  } finally { await launch?.cleanup(); await rm(root, { recursive: true, force: true }); }
});
