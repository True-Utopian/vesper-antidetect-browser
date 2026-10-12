import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { arch, platform } from 'node:os';
import { nativeExecutableHash, nativeRuntimeInventory } from '../packages/vesper-browser/dist/native-kernel.js';
import { qualifyNativeKernel } from '../packages/vesper-browser/dist/native-qualification.mjs';

const root = resolve(import.meta.dirname, '..');
function argument(name) { const index = process.argv.indexOf(name); if(index < 0 || !process.argv[index+1]) throw new Error(`Missing ${name}`); return resolve(process.argv[index+1]); }
const source = await realpath(argument('--output-directory'));
const dependencyList = argument('--runtime-deps');
const manifest = JSON.parse(await readFile(join(root, 'native/chromium/kernel.json'), 'utf8'));
const built = JSON.parse(await readFile(join(root, '.workbench/kernel-toolchain/build-result.json'), 'utf8'));
const units = JSON.parse(await readFile(join(root, '.workbench/kernel-toolchain/test-result.json'), 'utf8'));
const applied = JSON.parse(await readFile(join(root, '.workbench/kernel-toolchain/patch-result.json'), 'utf8'));
assert.equal(built.status, 'compiled-awaiting-native-qualification');
assert.equal(built.customKernelCompiled, true); assert.equal(built.revision, manifest.revision);
assert.equal(units.status, 'native-unit-tests-passed'); assert.equal(units.revision, manifest.revision);
assert.equal(units.nativeTestExecutions, 26);
assert.equal(applied.status, 'patches-applied'); assert.equal(applied.revision, manifest.revision);
for (const patch of manifest.patches) assert.equal(await nativeExecutableHash(join(root,'native/chromium/patches',patch)), applied.patches.find(entry=>entry.name===patch)?.sha256, 'Original patch changed after source preparation');
const executable = join(source, platform() === 'win32' ? 'chrome.exe' : 'chrome');
assert.equal(await nativeExecutableHash(executable), built.executableSha256);
const lines = [...new Set((await readFile(dependencyList, 'utf8')).split(/\r?\n/).map(line=>line.trim()).filter(Boolean))];
const files = [];
for (const name of lines) {
  if (name.endsWith('.pdb') || name.startsWith('./initialexe/')) continue;
  assert.ok(!isAbsolute(name), 'Runtime dependency must be relative');
  const file = await realpath(resolve(source, name)), inside = relative(source, file);
  assert.ok(!inside.startsWith('..') && !isAbsolute(inside), 'Runtime dependency must remain inside the build output');
  assert.ok((await stat(file)).isFile()); files.push({ path: inside.replaceAll('\\','/'), source: file });
}
assert.ok(files.some(file=>file.path === (platform()==='win32'?'chrome.exe':'chrome')));
const output = join(root, 'release/kernel', `${platform()}-${arch()}`, `Vesper-kernel-${manifest.chromiumVersion}-${built.executableSha256.slice(0,16)}`);
// Never overwrite an existing qualified runtime. Failed copies remain available for inspection.
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
for (const file of files) { const destination=join(output,file.path); await mkdir(dirname(destination),{recursive:true}); await copyFile(file.source,destination); }
const installedExecutable = join(output, platform()==='win32'?'chrome.exe':'chrome');
assert.equal(await nativeExecutableHash(installedExecutable), built.executableSha256);
const proof = await qualifyNativeKernel(installedExecutable);
await writeFile(join(output,'native-qualification.json'),JSON.stringify(proof,null,2));
assert.equal(proof.nativeProof,true,`Packaged native proof failed: ${proof.errors.join('; ')}`);
const patchHashes = [];
for(const patch of manifest.patches) patchHashes.push({path:patch,sha256:await nativeExecutableHash(join(root,'native/chromium/patches',patch))});
await copyFile(join(source,'../../LICENSE'),join(output,'CHROMIUM-LICENSE'));
await writeFile(join(output,'vesper-kernel.json'),JSON.stringify({schemaVersion:1,author:'true-utopian',revision:manifest.revision,chromiumVersion:manifest.chromiumVersion,patchHashes,executable:platform()==='win32'?'chrome.exe':'chrome',executableSha256:built.executableSha256,runtimeFiles:await nativeRuntimeInventory(installedExecutable),nativeUnitExecutions:26,qualification:proof},null,2));
console.log(JSON.stringify({state:'qualified-local-runtime',output,files:files.length,executable:installedExecutable,nativeProof:true}));
