import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesperBrowser, browserAccessToken, createBrowserServer, VesperBrowserClient, AdmissionJournal } from '../src/index.js';

test('versioned profile API retains leases, rejects stale edits and replays admitted creations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-contract-'));
  const token = await browserAccessToken(directory), runId = randomUUID();
  let browser = new VesperBrowser({ directory, executablePath: process.execPath });
  let server = await createBrowserServer(browser, token);
  const listen = async () => { await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); assert.ok(address && typeof address !== 'string'); return `http://127.0.0.1:${address.port}`; };
  let origin = await listen();
  const request = (path: string, method = 'GET', settings?: unknown, extra = {}) => fetch(`${origin}/api/v1${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(settings ? { 'content-type': 'application/json' } : {}), ...extra }, ...(settings ? { body: JSON.stringify(settings) } : {}) });
  try {
    const caps = await (await request('/capabilities')).json() as any; assert.equal(caps.apiVersion, '1.0'); assert.equal(caps.capabilities.leases, true);
    assert.equal((await request('/openapi.json')).status, 200);
    const headers = { 'idempotency-key': `test-${runId}`, 'x-vesper-run-id': runId };
    const first = await (await request('/profiles', 'POST', { name: `run-${runId}` }, headers)).json() as { id: string };
    const repeated = await (await request('/profiles', 'POST', { name: `run-${runId}` }, headers)).json(); assert.deepEqual(repeated, first);
    assert.equal((await request('/profiles', 'POST', { name: 'Different' }, headers)).status, 409);
    for (const [action, method, data] of [['stop', 'POST'], ['start', 'POST'], ['connection', 'GET'], ['archive', 'GET'], ['', 'PATCH', { name: 'Hijacked' }]] as const) assert.equal((await request(`/profiles/${first.id}${action ? '/' + action : ''}`, method, data)).status, 409);
    await new Promise<void>(done => server.close(() => done())); await browser.close();
    browser = new VesperBrowser({ directory, executablePath: process.execPath }); server = await createBrowserServer(browser, token); origin = await listen();
    assert.equal((await request(`/profiles/${first.id}/stop`, 'POST')).status, 409);
    const client = new VesperBrowserClient({ url: origin, tokenFile: join(directory, 'admin-token') });
    await client.claimProfile(first.id, runId); await client.stop(first.id); await client.releaseProfile(first.id);
    assert.equal((await request(`/profiles/${first.id}`, 'PATCH', { name: 'First edit' }, { 'if-match': '"1"' })).status, 200);
    assert.equal((await request(`/profiles/${first.id}`, 'PATCH', { name: 'Stale edit' }, { 'if-match': '"1"' })).status, 412);
    const events = await (await request('/events?after=0')).json() as any; assert.ok(events.events.length >= 4); assert.equal(events.resetRequired, false);
    const replay = await (await request(`/events?after=${events.cursor}`)).json() as any; assert.deepEqual(replay.events, []);
    await client.close();
  } finally { await new Promise<void>(done => server.close(() => done())); await browser.close(); await rm(directory, { recursive: true, force: true }); }
});

test('interrupted idempotent admission is quarantined instead of repeated after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-admission-'));
  try {
    const key = randomBytes(16).toString('hex'); let effects = 0;
    await assert.rejects(new AdmissionJournal(directory).execute(key, { effect: true }, async () => { effects++; throw new Error('Power loss after an external effect'); }));
    await assert.rejects(new AdmissionJournal(directory).execute(key, { effect: true }, async () => { effects++; return 'duplicated'; }), /interrupted/);
    assert.equal(effects, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
