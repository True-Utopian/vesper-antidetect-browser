import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesperBrowser } from '../src/browser.js';
import { nativeProfileArguments, nativeRuntimeInventory, verifyNativeRuntime } from '../src/native-kernel.js';

test('native receipts bind Linux component libraries and reject changed, missing or escaped components', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-linux-runtime-'));
  try {
    const executable = join(root, 'chrome'); await writeFile(executable, 'owned launcher');
    const library = join(root, 'libblink.so'); await writeFile(library, 'owned component');
    await writeFile(join(root, 'libEGL.so.1'), 'owned versioned component');
    const receipt = await nativeRuntimeInventory(executable);
    assert.deepEqual(receipt.map(file => file.path), ['chrome', 'libEGL.so.1', 'libblink.so']);
    await verifyNativeRuntime(executable, receipt);
    await writeFile(library, 'changed component');
    await assert.rejects(verifyNativeRuntime(executable, receipt), /runtime changed/);
    await rm(library);
    await assert.rejects(verifyNativeRuntime(executable, receipt), /runtime changed/);
    // Linux soname symlinks must be hashed and remain inside the kernel directory.
    if (process.platform !== 'win32') {
      await symlink('libEGL.so.1', library);
      assert.ok((await nativeRuntimeInventory(executable)).some(file => file.path === 'libblink.so'));
      await rm(library); await symlink(process.execPath, library);
      await assert.rejects(nativeRuntimeInventory(executable), /outside the kernel/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native identity survives archives and restart, while fresh profiles receive independent seeds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-native-identity-'));
  const engine = new VesperBrowser({ directory: join(root, 'store') });
  try {
    const settings = { engine: 'vesper', environment: { hardwareConcurrency: 3, deviceMemory: 4 }, fingerprint: { protection: 'standard' } };
    const first = await engine.create(settings), second = await engine.create(settings);
    const profile = await engine.readProfile(first.id);
    const args = await nativeProfileArguments(join(root, 'store', 'profiles', first.id, 'browser'), profile.settings);
    assert.ok(args.includes('--vesper-hardware-concurrency=3'));
    assert.ok(args.includes('--vesper-device-memory=4'));
    const other = await nativeProfileArguments(join(root, 'store', 'profiles', second.id, 'browser'), profile.settings);
    assert.notEqual(args.at(-1), other.at(-1));
    const archive = join(root, 'profile.tgz'); await engine.export(first.id, archive);
    const imported = await engine.importProfile(archive);
    assert.deepEqual(await nativeProfileArguments(join(root, 'store', 'profiles', imported.id, 'browser'), profile.settings), args);
    assert.deepEqual(await nativeProfileArguments(join(root, 'store', 'profiles', first.id, 'browser'), profile.settings), args);
    const off = await nativeProfileArguments(join(root, 'store', 'profiles', first.id, 'browser'), { ...profile.settings, fingerprint: { protection: 'off' } });
    assert.ok(off.every(arg => !arg.startsWith('--vesper-canvas-seed')));
    assert.deepEqual(await nativeProfileArguments(join(root, 'store', 'profiles', first.id, 'browser'), profile.settings), args);
  } finally { await engine.close(); await rm(root, { recursive: true, force: true }); }
});

test('native profiles reject unsupported memory and do not launch an unqualified or changed kernel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-native-admission-'));
  const engine = new VesperBrowser({ directory: join(root, 'store') });
  try {
    await assert.rejects(engine.create({ engine: 'chromium', environment: { deviceMemory: 4 } }), /requires the Vesper/);
    await assert.rejects(engine.create({ engine: 'vesper', environment: { deviceMemory: 3 } }), /native desktop bucket/);
    const profile = await engine.create({ engine: 'vesper' });
    await assert.rejects(engine.install(profile.id), /compiled Vesper kernel/);
    const candidate = join(root, 'candidate.exe'); await writeFile(candidate, 'owned invalid candidate');
    const component = join(root, 'blink.dll'); await writeFile(component, 'owned original component');
    const entry = await engine.stageNativeKernel(candidate);
    await writeFile(join(root, 'store', 'selected-native-kernel.json'), JSON.stringify(entry));
    await assert.rejects(engine.install(profile.id), /lacks direct native qualification/);
    await writeFile(join(root, 'store', 'selected-native-kernel.json'), JSON.stringify({ ...entry, qualification: { state: 'passed', nativeProof: true, executableSha256: entry.executableSha256 } }));
    await writeFile(component, 'owned changed component');
    await assert.rejects(engine.install(profile.id), /runtime changed/);
    await writeFile(candidate, 'owned modified candidate');
    await assert.rejects(engine.install(profile.id), /Native kernel changed/);
  } finally { await engine.close(); await rm(root, { recursive: true, force: true }); }
});

test('damaged persisted canvas identity fails instead of silently changing the profile fingerprint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-native-corrupt-'));
  try {
    const file = join(root, '.vesper-native-policy.json');
    await writeFile(file, JSON.stringify({ schemaVersion: 1, canvasSeed: 'not-a-seed' }));
    await assert.rejects(nativeProfileArguments(root, {}), /Invalid persisted/);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).canvasSeed, 'not-a-seed');
  } finally { await rm(root, { recursive: true, force: true }); }
});
