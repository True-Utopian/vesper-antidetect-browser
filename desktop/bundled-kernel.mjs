import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Discover the installer engine without changing the operator's active engine. */
export async function stageBundledKernel(browser, payload, manifestPath) {
  const file = await realpath(manifestPath);
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.author, 'true-utopian');
  assert.equal(manifest.nativeUnitExecutions, 26);
  assert.equal(manifest.qualification?.state, 'passed');
  assert.equal(manifest.qualification?.nativeProof, true);
  assert.equal(manifest.qualification.executableSha256, manifest.executableSha256);
  assert.ok(['chrome.exe', 'chrome'].includes(manifest.executable));
  const executable = await realpath(join(dirname(file), manifest.executable));
  const child = relative(dirname(file), executable);
  assert.ok(child && !child.startsWith('..') && !isAbsolute(child));
  const { nativeExecutableHash, verifyNativeRuntime } = await import(pathToFileURL(join(payload, 'packages/vesper-browser/dist/native-kernel.js')).href);
  assert.equal(await nativeExecutableHash(executable), manifest.executableSha256);
  await verifyNativeRuntime(executable, manifest.runtimeFiles);
  const state = await browser.engineVersions();
  const existing = state.staged?.find(entry => entry.family === 'vesper' && entry.executablePath === executable && entry.executableSha256 === manifest.executableSha256);
  return existing ?? browser.stageNativeKernel(executable);
}
