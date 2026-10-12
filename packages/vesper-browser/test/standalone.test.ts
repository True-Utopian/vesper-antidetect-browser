import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { VesperBrowser } from '../src/index.js';

test('standalone Browser creates encrypted proxy profiles and restores compatible archives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-browser-package-'));
  const browser = new VesperBrowser({ directory: join(root, 'browser'), executablePath: process.execPath });
  try {
    const original = await browser.create({ name: 'Independent', locale: 'en-GB', proxy: { value: 'http', extra: { host: '127.0.0.1', port: 8080, secret: 'private-credential' } } });
    assert.equal((await browser.listProfiles())[0]?.name, 'Independent');
    assert.ok(!(await readFile(join(root, 'browser', 'secrets', `${original.id}.sealed`))).includes(Buffer.from('private-credential')));
    const archive = join(root, 'compatible.workbench.tgz');
    await browser.export(original.id, archive);
    const imported = await browser.importProfile(archive);
    assert.equal((await browser.readProfile(imported.id)).hasProxy, false);
    assert.equal((await browser.readProfile(imported.id)).settings.locale, 'en-GB');
    assert.equal((await browser.versions(imported.id)).engineVersion, 'vesper-browser/0.4.2');
    const owner = new VesperBrowser({ directory: join(root, 'browser') });
    await assert.rejects(owner.listProfiles(), /Another Vesper Browser process/);
    await owner.close();
  } finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
});

test('standalone CLI manages profiles with only its own settings and private store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vesper-browser-cli-'));
  const run = promisify(execFile);
  const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const env = { ...process.env, VESPER_BROWSER_DIR: join(root, 'store') };
  const execute = (...args: string[]) => run(process.execPath, ['--import', 'tsx', cli, ...args], { env, windowsHide: true });
  try {
    await writeFile(join(root, 'settings.json'), JSON.stringify({ name: 'CLI fixture', timezone: 'Europe/London' }));
    assert.match((await execute('--help')).stdout, /Vesper Browser by true-utopian/);
    const { id } = JSON.parse((await execute('create', join(root, 'settings.json'))).stdout) as { id: string };
    assert.equal(JSON.parse((await execute('list')).stdout)[0].id, id);
    const archive = join(root, 'cli.workbench.tgz');
    await execute('export', id, archive);
    const imported = JSON.parse((await execute('import', archive)).stdout) as { id: string };
    assert.notEqual(imported.id, id);
    assert.equal(JSON.parse((await execute('list')).stdout).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
