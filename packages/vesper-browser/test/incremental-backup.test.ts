import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, link, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, relative, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashPrivateInventory, validateResumeBackup, validateBackupBase, createIncrementalBackup } from '../../../scripts/upgrade-inventory.mjs';

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'vesper-backup-incremental-'))), data = join(root, 'vesper');
  const backup = join(root, 'vesper-upgrade-backups', '2026-10-16T10-00-00-000Z-' + randomUUID());
  await mkdir(data); await mkdir(join(backup, 'data'), { recursive: true });
  await writeFile(join(data, 'token'), 'current-secret'); await writeFile(join(data, 'profile'), 'original-profile');
  for (const name of ['token', 'profile']) await writeFile(join(backup, 'data', name), await readFile(join(data, name)));
  const inventory = async () => hashPrivateInventory(data, await Promise.all(['token', 'profile'].map(async path => ({ path, bytes: (await stat(join(data, path))).size }))));
  const files = await inventory();
  await writeFile(join(backup, 'backup-manifest.json'), JSON.stringify({ source: data, files }));
  await writeFile(join(backup, 'upgrade-result.json'), JSON.stringify({ mode: 'apply', actualInstallationChanged: true, dataRoot: data, backup, checks: ['Backup verified', 'Original private data checksums preserved'] }));
  const close = async () => { assert.ok(relative(await realpath(tmpdir()), root).startsWith('vesper-backup-incremental-')); await rm(root, { recursive: true, force: true }); };
  return { root, data, backup, files, inventory, close };
}

test('a fresh incremental snapshot links backup bytes, copies changes and restores independently', async () => {
  const f = await fixture();
  try {
    const base = await validateBackupBase(f.data, f.backup);
    await writeFile(join(f.data, 'profile'), 'updated-profile');
    const entries = await f.inventory(), target = join(f.root, 'new-snapshot');
    const result = await createIncrementalBackup(f.data, target, entries, base);
    assert.equal(result.linkedFiles, 1); assert.equal(result.copiedFiles, 1);
    assert.equal((await stat(join(target, 'token'))).ino, (await stat(join(f.backup, 'data/token'))).ino);
    assert.notEqual((await stat(join(target, 'token'))).ino, (await stat(join(f.data, 'token'))).ino);
    assert.equal(await readFile(join(f.backup, 'data/profile'), 'utf8'), 'original-profile');
    assert.equal(await readFile(join(target, 'profile'), 'utf8'), 'updated-profile');
    assert.equal(dirname(f.backup), join(f.root, 'vesper-upgrade-backups')); assert.ok(basename(f.backup).startsWith('2026-10-16T'));
    await rm(f.backup, { recursive: true });
    assert.deepEqual(await hashPrivateInventory(target, entries), entries, 'Snapshot remains complete after the base directory is removed');
    await writeFile(join(f.data, 'token'), 'later-secret');
    assert.equal(await readFile(join(target, 'token'), 'utf8'), 'current-secret');
  } finally { await f.close(); }
});

test('completed snapshots cannot be resumed in place and a base must belong to the same store', async () => {
  const f = await fixture();
  try {
    await assert.rejects(validateResumeBackup(f.data, f.backup), /applied upgrade/);
    const other = join(f.root, 'other'); await mkdir(other);
    await assert.rejects(validateBackupBase(other, f.backup), /exact private store/);
    await writeFile(join(f.backup, 'upgrade-result.json'), JSON.stringify({ mode: 'dry-run', dataRoot: f.data, backup: f.backup }));
    await assert.rejects(validateBackupBase(f.data, f.backup), /completed, verified/);
  } finally { await f.close(); }
});

test('corrupt base bytes fail the complete new-snapshot verification without changing the live store', async () => {
  const f = await fixture();
  try {
    const base = await validateBackupBase(f.data, f.backup);
    await writeFile(join(f.backup, 'data/profile'), 'tampered-profile');
    await assert.rejects(createIncrementalBackup(f.data, join(f.root, 'new-snapshot'), f.files, base), /checksum verification|changed/);
    assert.deepEqual(await f.inventory(), f.files);
  } finally { await f.close(); }
});

test('live-store aliases are copied rather than propagated into the new backup', async () => {
  const f = await fixture();
  try {
    const base = await validateBackupBase(f.data, f.backup);
    await rm(join(f.backup, 'data/token')); await link(join(f.data, 'token'), join(f.backup, 'data/token'));
    const target = join(f.root, 'new-snapshot'), result = await createIncrementalBackup(f.data, target, f.files, base);
    assert.equal(result.copiedFiles, 1); assert.notEqual((await stat(join(target, 'token'))).ino, (await stat(join(f.data, 'token'))).ino);
    await writeFile(join(f.data, 'token'), 'changed-live-key');
    assert.equal(await readFile(join(target, 'token'), 'utf8'), 'current-secret');
  } finally { await f.close(); }
});

test('missing base files fall back to independent copies; escaped inventory paths are rejected', async () => {
  const f = await fixture();
  try {
    const base = await validateBackupBase(f.data, f.backup); await rm(join(f.backup, 'data/token'));
    const target = join(f.root, 'new-snapshot'), result = await createIncrementalBackup(f.data, target, f.files, base);
    assert.equal(result.copiedFiles, 1); assert.deepEqual(await hashPrivateInventory(target, f.files), f.files);
    await assert.rejects(createIncrementalBackup(f.data, join(f.root, 'escaped'), [{ ...f.files[0]!, path: '../outside' }], base), /escaped/);
    await writeFile(join(f.backup, 'backup-manifest.json'), JSON.stringify({ source: f.data, files: [{ ...f.files[0], path: '../outside' }] }));
    await assert.rejects(validateBackupBase(f.data, f.backup), /escaped/);
  } finally { await f.close(); }
});

test('a linked base data directory is rejected without following it into the live store', async () => {
  const f = await fixture();
  try {
    assert.equal(dirname(f.backup), join(f.root, 'vesper-upgrade-backups'));
    await rm(join(f.backup, 'data'), { recursive: true });
    await symlink(f.data, join(f.backup, 'data'), 'junction');
    await assert.rejects(validateBackupBase(f.data, f.backup), /real data copy/);
    assert.deepEqual(await f.inventory(), f.files);
  } finally { await f.close(); }
});

test('empty database and browser directories survive an independently restorable snapshot', async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.data, 'database/pg_tblspc'), { recursive: true });
    await mkdir(join(f.data, 'browser/empty-cache'), { recursive: true });
    const base = await validateBackupBase(f.data, f.backup), target = join(f.root, 'new-snapshot');
    await createIncrementalBackup(f.data, target, f.files, base);
    assert.equal((await stat(join(target, 'database/pg_tblspc'))).isDirectory(), true);
    assert.equal((await stat(join(target, 'browser/empty-cache'))).isDirectory(), true);
    assert.deepEqual(await hashPrivateInventory(target, f.files), f.files);
  } finally { await f.close(); }
});
