import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = '@true-utopian/vesper-browser';
const publicFiles = ['dist', 'public', 'package.json', 'README.md', 'LICENSE'];
function inside(root, path) { const child = relative(root, path); if (!child || child.startsWith('..') || isAbsolute(child)) throw Error('Workspace copy escaped its project'); }
async function info(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }
async function fingerprint(root) {
  const hash = createHash('sha256');
  async function walk(path) {
    const record = await lstat(path);
    if (record.isSymbolicLink()) throw Error('Workspace public files must not contain symbolic links');
    if (record.isDirectory()) { for (const file of (await readdir(path)).sort()) await walk(join(path, file)); }
    else if (record.isFile()) { hash.update(relative(root, path).replaceAll('\\', '/')); hash.update('\0'); hash.update(await readFile(path)); hash.update('\0'); }
    else throw Error('Unexpected workspace package entry');
  }
  for (const entry of publicFiles) await walk(join(root, entry));
  return hash.digest('hex');
}

/** npm workspaces use links. exFAT cannot preserve them, so maintain an exact,
 * ordinary package copy there. Never replace an unrelated directory or follow
 * a misplaced link outside this project. */
export async function syncBrowserWorkspace(projectDirectory) {
  const root = await realpath(projectDirectory), source = await realpath(join(root, 'packages/vesper-browser'));
  inside(root, source);
  const metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (metadata.name !== name) throw Error('Unexpected Browser workspace package');
  await readFile(join(source, 'dist/index.js')); // Build first; never install a partial source package.
  const scope = join(root, 'node_modules/@true-utopian'); await mkdir(scope, { recursive: true }); inside(root, await realpath(scope));
  const destination = join(scope, 'vesper-browser'), current = await info(destination);
  if (current?.isSymbolicLink()) {
    const physical = await realpath(destination).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    if (physical === source) return { mode: 'workspace-link', version: metadata.version };
  } else if (current) {
    if (!current.isDirectory()) throw Error('Browser dependency destination is not a directory');
    const entries = await readdir(destination);
    if (entries.length) {
      const installed = await readFile(join(destination, 'package.json'), 'utf8').then(JSON.parse).catch(() => undefined);
      if (installed?.name !== name) throw Error('Refusing to replace an unrelated dependency directory');
    }
  }
  const digest = await fingerprint(source);
  if (current && !current.isSymbolicLink()) {
    const marker = await readFile(join(destination, '.vesper-workspace-copy.json'), 'utf8').then(JSON.parse).catch(() => undefined);
    if (marker?.source === source && marker.sha256 === digest && await fingerprint(destination) === digest) return { mode: 'portable-copy', changed: false, version: metadata.version };
  }
  const stage = join(scope, '.vesper-browser-stage-' + randomUUID()), previous = join(scope, '.vesper-browser-previous-' + randomUUID());
  await mkdir(stage);
  let moved = false, installed = false;
  async function cleanup(path) {
    inside(scope, resolve(path));
    const record = await info(path); if (!record) return;
    if (record.isSymbolicLink()) await unlink(path);
    else { inside(await realpath(scope), await realpath(path)); await rm(path, { recursive: true }); }
  }
  try {
    for (const entry of publicFiles) await cp(join(source, entry), join(stage, entry), { recursive: true, dereference: false });
    if (await fingerprint(stage) !== digest) throw Error('Browser workspace changed while copying; rebuild before retrying');
    await writeFile(join(stage, '.vesper-workspace-copy.json'), JSON.stringify({ schemaVersion: 1, source, sha256: digest }));
    if (current) { await rename(destination, previous); moved = true; }
    try { await rename(stage, destination); installed = true; }
    catch (error) { if (moved) { await rename(previous, destination); moved = false; } throw error; }
    if (moved) await cleanup(previous);
    return { mode: 'portable-copy', changed: true, version: metadata.version };
  } finally { if (!installed) await cleanup(stage); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await syncBrowserWorkspace(resolve(import.meta.dirname, '..'))));
