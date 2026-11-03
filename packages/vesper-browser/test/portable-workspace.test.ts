import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { syncBrowserWorkspace } from '../../../scripts/sync-browser-workspace.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'vesper-portable-workspace-')), source = join(root, 'packages/vesper-browser'), target = join(root, 'node_modules/@true-utopian/vesper-browser');
  await mkdir(join(source, 'dist'), { recursive: true }); await mkdir(join(source, 'public/docs'), { recursive: true });
  await writeFile(join(source, 'package.json'), JSON.stringify({ name: '@true-utopian/vesper-browser', version: '1.0.0', type: 'module', exports: './dist/index.js' }));
  await writeFile(join(source, 'dist/index.js'), "export const marker = 'v1';\n");
  await writeFile(join(source, 'public/docs/index.html'), 'Bundled docs');
  for (const name of ['README.md', 'LICENSE']) await writeFile(join(source, name), name);
  return { root, source, target, close: () => rm(root, { recursive: true, force: true }) };
}
test('an empty copied workspace placeholder becomes a complete ordinary package', async () => {
  const f = await fixture(); try {
    await mkdir(f.target, { recursive: true });
    const result = await syncBrowserWorkspace(f.root); assert.equal(result.mode, 'portable-copy');
    assert.equal((await import(pathToFileURL(join(f.target, 'dist/index.js')).href)).marker, 'v1');
    assert.equal(await readFile(join(f.target, 'public/docs/index.html'), 'utf8'), 'Bundled docs');
    assert.equal((await syncBrowserWorkspace(f.root)).changed, false);
  } finally { await f.close(); }
});
test('copy refresh detects same-size, same-timestamp changes and removes stale output', async () => {
  const f = await fixture(); try {
    await writeFile(join(f.source, 'dist/obsolete.js'), 'old'); await syncBrowserWorkspace(f.root);
    const file = join(f.source, 'dist/index.js'), before = await stat(file);
    await writeFile(file, "export const marker = 'v2';\n"); await utimes(file, before.atime, before.mtime); await rm(join(f.source, 'dist/obsolete.js'));
    assert.equal((await syncBrowserWorkspace(f.root)).changed, true);
    assert.equal((await import(pathToFileURL(join(f.target, 'dist/index.js')).href)).marker, 'v2');
    await assert.rejects(stat(join(f.target, 'dist/obsolete.js')), { code: 'ENOENT' });
  } finally { await f.close(); }
});
test('a normal workspace link remains untouched', async () => {
  const f = await fixture(); try {
    await mkdir(join(f.root, 'node_modules/@true-utopian'), { recursive: true }); await symlink(f.source, f.target, 'junction');
    assert.equal((await syncBrowserWorkspace(f.root)).mode, 'workspace-link');
  } finally { await f.close(); }
});
test('unrelated dependency contents and linked source assets are preserved and rejected', async () => {
  const f = await fixture(); try {
    await mkdir(f.target, { recursive: true }); await writeFile(join(f.target, 'note.txt'), 'Keep this file');
    await assert.rejects(syncBrowserWorkspace(f.root), /unrelated dependency/);
    assert.equal(await readFile(join(f.target, 'note.txt'), 'utf8'), 'Keep this file');
    await rm(f.target, { recursive: true });
    await mkdir(join(f.root, 'outside')); await symlink(join(f.root, 'outside'), join(f.source, 'public/linked'), 'junction');
    await assert.rejects(syncBrowserWorkspace(f.root), /symbolic links/);
  } finally { await f.close(); }
});
