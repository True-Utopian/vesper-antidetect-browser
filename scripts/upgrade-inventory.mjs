import { createReadStream, constants } from 'node:fs';
import { lstat, realpath, readFile, readdir, mkdir, link, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, dirname, join, basename, sep } from 'node:path';

/** Enumerate large stores without spreading an entire subtree into call arguments. */
export async function listPrivateFiles(root, { readDirectory = readdir, statEntry = lstat } = {}) {
  const values = [], pending = [''];
  while (pending.length) {
    const directory = pending.pop();
    for (const item of await readDirectory(join(root, directory), { withFileTypes: true })) {
      const path = join(directory, item.name), metadata = await statEntry(join(root, path));
      if (metadata.isSymbolicLink()) throw Error('The private data store contains a link; review it before upgrading');
      if (metadata.isDirectory()) pending.push(path);
      else {
        if (!metadata.isFile()) throw Error('Unexpected private data entry');
        values.push({ path, bytes: metadata.size });
      }
    }
  }
  return values.sort((a, b) => a.path.localeCompare(b.path));
}

/** An interrupted backup can be reused only after the caller rechecks all bytes. */
async function privateBackup(dataDirectory, candidate) {
  const data = await realpath(dataDirectory), parent = join(dirname(data), 'vesper-upgrade-backups');
  const parentInfo = await lstat(parent), info = await lstat(candidate);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || !info.isDirectory() || info.isSymbolicLink()) throw Error('Resume only a real private backup directory');
  const backup = await realpath(candidate), expected = await realpath(parent);
  if (dirname(backup) !== expected || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}$/.test(basename(backup))) throw Error('Resume backup escaped the private backup root');
  const copy = await lstat(join(backup, 'data'));
  if (!copy.isDirectory() || copy.isSymbolicLink()) throw Error('Interrupted backup must contain a real data copy');
  return backup;
}
export async function validateResumeBackup(dataDirectory, candidate) {
  const backup = await privateBackup(dataDirectory, candidate);
  try { await lstat(join(backup, 'upgrade-result.json')); throw Error('Do not reuse a backup from an applied upgrade'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return backup;
}

/** A completed snapshot can seed a NEW full backup; never resume/modify it. */
export async function validateBackupBase(dataDirectory, candidate) {
  const backup = await privateBackup(dataDirectory, candidate);
  for (const name of ['backup-manifest.json', 'upgrade-result.json']) {
    const info = await lstat(join(backup, name));
    if (!info.isFile() || info.isSymbolicLink() || info.size > 128 * 1024 ** 2) throw Error('Invalid completed backup metadata');
  }
  const manifest = JSON.parse(await readFile(join(backup, 'backup-manifest.json'), 'utf8'));
  const result = JSON.parse(await readFile(join(backup, 'upgrade-result.json'), 'utf8'));
  const data = await realpath(dataDirectory);
  if (await realpath(manifest.source) !== data || await realpath(result.dataRoot) !== data || await realpath(result.backup) !== backup || result.mode !== 'apply' || result.actualInstallationChanged !== true || !result.checks?.includes('Backup verified') || !result.checks?.includes('Original private data checksums preserved') || !Array.isArray(manifest.files)) throw Error('Base must be a completed, verified backup of this exact private store');
  const paths = new Set();
  for (const entry of manifest.files) {
    if (typeof entry?.path !== 'string' || isAbsolute(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256) || paths.has(entry.path)) throw Error('Invalid completed backup inventory');
    const child = relative(join(backup, 'data'), resolve(backup, 'data', entry.path));
    if (!child || child.startsWith('..') || isAbsolute(child)) throw Error('Completed backup inventory escaped its root');
    paths.add(entry.path);
  }
  return { backup, entries: manifest.files };
}

/** Independently restorable snapshot. Link immutable OLD BACKUP bytes only;
 * never link live store files, and verify every destination byte before return. */
export async function createIncrementalBackup(sourceDirectory, destinationDirectory, entries, base, { concurrency = 8 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) throw Error('Invalid backup concurrency');
  const source = await realpath(sourceDirectory), baseRoot = await realpath(join(base.backup, 'data'));
  const destination = resolve(destinationDirectory), childOfSource = relative(source, destination), childOfBase = relative(baseRoot, destination);
  if (!childOfSource || !childOfSource.startsWith('..') && !isAbsolute(childOfSource) || !childOfBase || !childOfBase.startsWith('..') && !isAbsolute(childOfBase)) throw Error('New snapshot must be separate from the live store and its base');
  await mkdir(destination, { recursive: false, mode: 0o700 });
  const target = await realpath(destination), seen = new Set(), baseEntries = new Map(base.entries.map(entry => [entry.path, entry]));
  const safe = (root, name) => { const path = resolve(root, name), child = relative(root, path); if (typeof name !== 'string' || !child || child.startsWith('..') || isAbsolute(child)) throw Error('Backup entry escaped its root'); return path; };
  // Build and validate parents before the parallel readers start. Never follow
  // pre-existing links in a new snapshot, including directory components.
  const directories = new Set();
  for (const entry of entries) {
    if (seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('Invalid or duplicate backup entry');
    seen.add(entry.path); let parent = dirname(safe(target, entry.path));
    while (parent !== target) { directories.add(parent); parent = dirname(parent); }
  }
  // PostgreSQL and browser stores can require empty directories. Enumerate
  // directory entries without following links; copying only files is incomplete.
  let level = [source];
  while (level.length) {
    const next = []; let index = 0, scanFailure;
    async function scan() {
      while (!scanFailure && index < level.length) {
        const folder = level[index++];
        try {
          for (const item of await readdir(folder, { withFileTypes: true })) {
            if (item.isSymbolicLink()) throw Error('Live store contains a linked directory entry');
            if (!item.isDirectory()) continue;
            const path = join(folder, item.name), info = await lstat(path);
            if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Live store directory changed or is linked');
            const child = relative(source, await realpath(path));
            if (!child || child.startsWith('..') || isAbsolute(child)) throw Error('Live store directory escaped its root');
            directories.add(safe(target, child)); next.push(path);
          }
        } catch (error) { scanFailure ??= error; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, level.length) }, scan));
    if (scanFailure) throw scanFailure;
    level = next;
  }
  for (const parent of [...directories].sort((a, b) => a.split(sep).length - b.split(sep).length || a.localeCompare(b))) {
    try { await mkdir(parent, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await lstat(parent); if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Snapshot parent must be a real private directory');
  }
  let cursor = 0, failure; const stats = { linkedFiles: 0, copiedFiles: 0, bytes: entries.reduce((n, e) => n + e.bytes, 0) };
  async function worker() {
    while (!failure && cursor < entries.length) {
      const entry = entries[cursor++];
      try {
        const from = safe(source, entry.path), to = safe(target, entry.path), original = await lstat(from), physical = await realpath(from), child = relative(source, physical);
        if (!original.isFile() || original.isSymbolicLink() || original.size !== entry.bytes || !child || child.startsWith('..') || isAbsolute(child)) throw Error('Live store changed or contains a linked file');
        const prior = baseEntries.get(entry.path); let linked = false;
        if (prior?.bytes === entry.bytes && prior?.sha256 === entry.sha256) {
          const old = safe(baseRoot, entry.path);
          const oldInfo = await lstat(old).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
          if (oldInfo) {
            const oldChild = relative(baseRoot, await realpath(old));
            if (!oldInfo.isFile() || oldInfo.isSymbolicLink() || !oldChild || oldChild.startsWith('..') || isAbsolute(oldChild)) throw Error('Base snapshot contains a linked or invalid file');
            // A base maliciously linked to the live store is never propagated.
            if (oldInfo.size === entry.bytes && !(oldInfo.dev === original.dev && oldInfo.ino === original.ino)) {
              try { await link(old, to); linked = true; stats.linkedFiles++; }
              catch (error) { if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
            }
          }
        }
        if (!linked) { await copyFile(from, to, constants.COPYFILE_EXCL); stats.copiedFiles++; }
      } catch (error) { failure ??= error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  if (failure) throw failure;
  const verified = await hashPrivateInventory(target, entries, { concurrency });
  if (verified.some((entry, i) => entry.sha256 !== entries[i].sha256)) throw Error('Incremental snapshot checksum verification failed');
  return stats;
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}

/** Hash every private file with bounded I/O; drain readers before any rejection. */
export async function hashPrivateInventory(directory, entries, { concurrency = 8, hashFile = digest } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) throw Error('Invalid inventory concurrency');
  const root = await realpath(directory), result = entries.map(entry => ({ ...entry }));
  let cursor = 0, failure;
  async function worker() {
    while (!failure && cursor < result.length) {
      const index = cursor++, entry = result[index];
      try {
        if (typeof entry.path !== 'string' || isAbsolute(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw Error('Invalid private inventory entry');
        const file = resolve(root, entry.path), child = relative(root, file);
        if (!child || child.startsWith('..') || isAbsolute(child)) throw Error('Inventory file escaped its private root');
        const before = await lstat(file), physical = await realpath(file), inside = relative(root, physical);
        if (!before.isFile() || before.isSymbolicLink() || !inside || inside.startsWith('..') || isAbsolute(inside) || before.size !== entry.bytes) throw Error('Private inventory file changed or is linked outside the store');
        entry.sha256 = await hashFile(file);
        const after = await lstat(file);
        if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !after.isFile() || after.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) throw Error('Private inventory file changed during hashing');
      } catch (error) { failure ??= error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, result.length) }, worker));
  if (failure) throw failure;
  return result;
}
