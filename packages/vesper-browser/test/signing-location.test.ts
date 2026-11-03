import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateKey } from '../../../scripts/local-update-signing.mjs';

test('a moved configured signing key keeps its original public trust identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-key-location-')); try {
    const directory = join(root, '.workbench/release-signing'), file = join(root, 'protected-original.pem'), pair = generateKeyPairSync('ed25519');
    await mkdir(directory, { recursive: true }); await writeFile(file, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    await writeFile(join(directory, 'location.json'), JSON.stringify({ schemaVersion: 1, privateKeyFile: file }));
    assert.equal((await updateKey({ projectRoot: root, environment: {}, platform: 'linux' })).publicKey, pair.publicKey.export({ type: 'spki', format: 'pem' }));
    await assert.rejects(stat(join(directory, 'ed25519-private.pem')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('a missing configured key fails instead of silently generating replacement trust', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-key-location-')); try {
    const file = join(root, 'missing.pem');
    await assert.rejects(updateKey({ projectRoot: root, environment: { VESPER_UPDATE_SIGNING_KEY_FILE: file }, platform: 'linux' }), { code: 'ENOENT' });
    await assert.rejects(stat(file), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('existing legacy signing keys remain unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-key-location-')); try {
    const directory = join(root, '.workbench/release-signing'), file = join(directory, 'ed25519-private.pem'), pair = generateKeyPairSync('ed25519');
    await mkdir(directory, { recursive: true }); await writeFile(file, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const before = await readFile(file);
    assert.equal((await updateKey({ projectRoot: root, environment: {}, platform: 'linux' })).publicKey, pair.publicKey.export({ type: 'spki', format: 'pem' }));
    assert.deepEqual(await readFile(file), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
