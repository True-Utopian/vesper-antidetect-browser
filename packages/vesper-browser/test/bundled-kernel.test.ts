import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error Desktop scripts are shipped as JavaScript.
import { stageBundledKernel } from '../../../desktop/bundled-kernel.mjs';
import { nativeExecutableHash, nativeRuntimeInventory } from '../src/native-kernel.js';

async function fixture(t: any) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'vesper-bundled-contract-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, 'chrome.exe');
  await writeFile(executable, 'Owned fixture; never executed');
  await writeFile(join(directory, 'policy.dll'), 'Original policy fixture');
  const sha = await nativeExecutableHash(executable);
  const manifest = { schemaVersion: 1, author: 'true-utopian', nativeUnitExecutions: 26, executable: 'chrome.exe', executableSha256: sha, runtimeFiles: await nativeRuntimeInventory(executable), qualification: { state: 'passed', nativeProof: true, executableSha256: sha } };
  const path = join(directory, 'vesper-kernel.json');
  await writeFile(path, JSON.stringify(manifest));
  // A clean source checkout has no dist tree. Re-export the real source hash
  // implementation through an owned payload fixture rather than using old output.
  const payload = join(directory, 'payload');
  await mkdir(join(payload, 'packages/vesper-browser/dist'), { recursive: true });
  await writeFile(join(payload, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(join(payload, 'packages/vesper-browser/dist/native-kernel.js'), `export { nativeExecutableHash, verifyNativeRuntime } from ${JSON.stringify(new URL('../src/native-kernel.ts', import.meta.url).href)};`);
  return { directory, executable, manifest, path, payload };
}

test('bundled discovery stages an intact runtime without activating or editing profiles', async t => {
  const f = await fixture(t), calls: string[] = [];
  const browser = { engineVersions: async () => ({ staged: [] }), stageNativeKernel: async (path: string) => { calls.push(path); return { buildId: 'owned-fixture' }; }, activateEngine: () => { throw Error('Must not activate on startup'); } };
  assert.deepEqual(await stageBundledKernel(browser, f.payload, f.path), { buildId: 'owned-fixture' });
  assert.deepEqual(calls, [f.executable]);
});

test('bundled discovery reuses an already staged identical runtime', async t => {
  const f = await fixture(t), entry = { family: 'vesper', executablePath: f.executable, executableSha256: f.manifest.executableSha256, qualification: { state: 'passed' } };
  const browser = { engineVersions: async () => ({ staged: [entry] }), stageNativeKernel: () => { throw Error('Must retain existing qualification'); } };
  assert.deepEqual(await stageBundledKernel(browser, f.payload, f.path), entry);
});

test('bundled discovery rejects changed policy libraries before staging', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, 'policy.dll'), 'Changed policy fixture');
  const browser = { engineVersions: () => { throw Error('Must reject before state access'); } };
  await assert.rejects(stageBundledKernel(browser, f.payload, f.path), /runtime changed/);
});

test('bundled discovery rejects missing native acceptance and executable traversal', async t => {
  const f = await fixture(t), browser = {};
  f.manifest.qualification.nativeProof = false;
  await writeFile(f.path, JSON.stringify(f.manifest));
  await assert.rejects(stageBundledKernel(browser, f.payload, f.path));
  f.manifest.qualification.nativeProof = true;
  f.manifest.executable = '../chrome.exe';
  await writeFile(f.path, JSON.stringify(f.manifest));
  await assert.rejects(stageBundledKernel(browser, f.payload, f.path));
});
