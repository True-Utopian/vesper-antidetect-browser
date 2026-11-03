import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, lstat, symlink, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import location from '../../../desktop/data-location.cjs';

async function fixture() {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'vesper-desktop-location-')));
  const data = join(home, 'original-store'), other = join(home, 'other-store'), pointer = join(home, '.vesper/desktop-location.json');
  await mkdir(data); await mkdir(other); await writeFile(join(data, 'profile.fixture'), 'original private bytes');
  return { home, data, other, pointer, close: () => rm(home, { recursive: true, force: true }) };
}

test('new desktops retain their normal per-user location until one is registered', async () => {
  const f = await fixture(); try {
    assert.equal(location.resolveDesktopDataRoot({ home: f.home, defaultRoot: f.other }), f.other);
    location.preflightDesktopDataRoot(f.data, { home: f.home });
    await assert.rejects(lstat(f.pointer), { code: 'ENOENT' });
  } finally { await f.close(); }
});
test('both desktop products use the same canonical store despite differing APPDATA defaults', async () => {
  const f = await fixture(); try {
    const result = location.registerDesktopDataRoot(f.data, { home: f.home }); assert.equal(result.created, true);
    for (const defaultRoot of [f.other, join(f.home, 'different-appdata')]) assert.equal(location.resolveDesktopDataRoot({ home: f.home, defaultRoot }), f.data);
    assert.equal(await readFile(join(f.data, 'profile.fixture'), 'utf8'), 'original private bytes');
    assert.equal((await readdir(join(f.home, '.vesper'))).length, 1);
  } finally { await f.close(); }
});
test('an explicit fixture override wins over an unavailable configured store', async () => {
  const f = await fixture(); try {
    location.registerDesktopDataRoot(f.data, { home: f.home }); await rm(f.data, { recursive: true });
    assert.equal(location.resolveDesktopDataRoot({ override: f.other, home: f.home, defaultRoot: f.data }), resolve(f.other));
    assert.throws(() => location.resolveDesktopDataRoot({ home: f.home, defaultRoot: f.other }), /unavailable/);
  } finally { await f.close(); }
});
test('re-registration preserves the existing pointer bytes and rejects another store', async () => {
  const f = await fixture(); try {
    location.registerDesktopDataRoot(f.data, { home: f.home }); const original = await readFile(f.pointer);
    assert.equal(location.registerDesktopDataRoot(f.data, { home: f.home }).created, false);
    assert.throws(() => location.registerDesktopDataRoot(f.other, { home: f.home }), /already configured/);
    assert.deepEqual(await readFile(f.pointer), original);
  } finally { await f.close(); }
});
test('invalid or unsupported saved locations fail rather than creating an empty fallback', async () => {
  const f = await fixture(); try {
    await mkdir(join(f.home, '.vesper'));
    for (const body of ['{', JSON.stringify({ schemaVersion: 2, dataRoot: f.data }), JSON.stringify({ schemaVersion: 1, dataRoot: 'relative/path' }), JSON.stringify({ schemaVersion: 1, dataRoot: join(f.home, 'missing') })]) {
      await writeFile(f.pointer, body);
      assert.throws(() => location.resolveDesktopDataRoot({ home: f.home, defaultRoot: f.other }));
      assert.deepEqual(await readdir(f.other), []);
    }
  } finally { await f.close(); }
});
test('registration refuses a linked pointer parent without changing its target', async () => {
  const f = await fixture(); try {
    await symlink(f.other, join(f.home, '.vesper'), 'junction');
    assert.throws(() => location.registerDesktopDataRoot(f.data, { home: f.home }), /ordinary directory/);
    assert.deepEqual(await readdir(f.other), []);
  } finally { await f.close(); }
});
test('a saved location must be an ordinary small file and reference an existing directory', async () => {
  const f = await fixture(); try {
    await mkdir(join(f.home, '.vesper')); await mkdir(f.pointer);
    assert.throws(() => location.resolveDesktopDataRoot({ home: f.home, defaultRoot: f.other }), /Invalid/);
    await rm(f.pointer, { recursive: true }); await writeFile(f.pointer, ' '.repeat(65537));
    assert.throws(() => location.resolveDesktopDataRoot({ home: f.home, defaultRoot: f.other }), /Invalid/);
    assert.throws(() => location.preflightDesktopDataRoot(join(f.data, 'profile.fixture'), { home: f.home }), /not a directory/);
  } finally { await f.close(); }
});
