import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesperBrowser, browserAccessToken, createBrowserServer, documentationContext } from '../src/index.js';

test('bundled docs expose only static contract material, preserve profiles and leave APIs authenticated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-docs-'));
  const browser = new VesperBrowser({ directory, executablePath: process.execPath });
  const token = await browserAccessToken(directory), server = await createBrowserServer(browser, token);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const profile = await browser.create({ name: 'Private documentation fixture' });
    for (const path of ['/docs', '/docs/', '/docs/app.js', '/docs/styles.css', '/docs/guides.json', '/docs/context.json', '/docs/openapi.json', '/docs/vesper-mark.svg']) {
      const response = await fetch(origin + path), text = await response.text();
      assert.equal(response.status, 200, path); assert.ok(response.headers.get('content-security-policy')?.includes("script-src 'self'"));
      assert.ok(!text.includes(token)); assert.ok(!text.includes(profile.id)); assert.ok(!text.includes('Private documentation fixture'));
      assert.ok(!/https?:\/\/(?:cdn|fonts\.)/.test(text));
    }
    const context = await (await fetch(origin + '/docs/context.json')).json() as any;
    assert.equal(context.product, 'Browser'); assert.equal(context.apiVersion, '1.0'); assert.equal(context.browserDocs, undefined);
    assert.equal((await fetch(origin + '/api/v1/profiles')).status, 401);
    assert.equal((await fetch(origin + '/api/v1/openapi.json')).status, 401);
    const contract = await (await fetch(origin + '/api/v1/openapi.json', { headers: { authorization: `Bearer ${token}` } })).json();
    assert.deepEqual(await (await fetch(origin + '/docs/openapi.json')).json(), contract);
    assert.equal((await fetch(origin + '/docs/admin-token')).status, 404);
    assert.equal((await fetch(origin + '/docs/guides.json', { method: 'POST' })).status, 404);
    assert.deepEqual((await browser.listProfiles()).map(p => p.id), [profile.id]);
    assert.equal(documentationContext('Workbench', 'test', 'http://user:secret@localhost:12').browserDocs, undefined);
    assert.equal(documentationContext('Workbench', 'test', 'https://example.com').browserDocs, undefined);
    assert.equal(documentationContext('Workbench', 'test', 'http://127.0.0.1:4567').browserDocs, 'http://127.0.0.1:4567/docs');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await browser.close(); await rm(directory, { recursive: true, force: true }); }
});
