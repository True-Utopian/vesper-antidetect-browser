import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, dirname, join, basename } from 'node:path';

/** An interrupted backup can be reused only after the caller rechecks all bytes. */
export async function validateResumeBackup(dataDirectory, candidate) {
  const data = await realpath(dataDirectory), parent = join(dirname(data), 'vesper-upgrade-backups');
  const parentInfo = await lstat(parent), info = await lstat(candidate);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || !info.isDirectory() || info.isSymbolicLink()) throw Error('Resume only a real private backup directory');
  const backup = await realpath(candidate), expected = await realpath(parent);
  if (dirname(backup) !== expected || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}$/.test(basename(backup))) throw Error('Resume backup escaped the private backup root');
  const copy = await lstat(join(backup, 'data'));
  if (!copy.isDirectory() || copy.isSymbolicLink()) throw Error('Interrupted backup must contain a real data copy');
  try { await lstat(join(backup, 'upgrade-result.json')); throw Error('Do not reuse a backup from an applied upgrade'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return backup;
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
