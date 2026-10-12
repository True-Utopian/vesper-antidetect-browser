import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { durableWrite } from './storage.js';

export const apiVersion = '1.0';
export const capabilities = { profiles: true, revisions: true, archives: true, proxies: ['http', 'socks5'], leases: true, eventReplay: true, cdp: true, templates:true, trash:true, metadata:true, bulkActions:true, cookies:true, extensions:{manifestVersions:[3],localPackages:true,perProfile:true}, environmentPolicies:true, nativePrivacyEngine:'brave-optional', fingerprintPolicies:true, targetPolicies:true, engineUpdates:true, proprietaryFingerprints: false };
export const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });
export function leaseKey(token: string, id: string, runId: string) { return createHmac('sha256', token).update(`vesper-lease-v1:${id}:${runId}`).digest('base64url'); }
type Event = { cursor: number; type: string; profileId: string; at: string };
type State = { version: 1; leases: Record<string, { runId: string; acquiredAt: string }>; events: Event[]; cursor: number };

/** Owned by the Browser service, persisted before lifecycle replies. No automatic lease expiry. */
export class BrowserContract {
  private state: State = { version: 1, leases: {}, events: [], cursor: 0 };
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private directory: string, private token: string) {}
  async init() {
    try {
      const state = JSON.parse(await readFile(join(this.directory, 'api-state.json'), 'utf8')) as State;
      if (state.version !== 1 || !state.leases || !Array.isArray(state.events) || !Number.isSafeInteger(state.cursor)) throw new Error('Invalid Browser API journal');
      this.state = state;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.catch(() => {}).then(action); this.tail = next; return next;
  }
  lease(id: string) { return this.state.leases[id]; }
  assertAccess(id: string, presented: string | undefined) {
    const lease = this.lease(id); if (!lease) return;
    const actual = Buffer.from(presented ?? ''), expected = Buffer.from(leaseKey(this.token, id, lease.runId));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw conflict(`Profile belongs to automation run ${lease.runId}. Use its run controls or explicitly interrupt its lease.`);
  }
  async acquire(id: string, runId: string) {
    if (!/^[a-f0-9-]{36}$/.test(runId)) throw Object.assign(new Error('Invalid automation run ID'), { status: 400 });
    const prior = this.lease(id);
    if (prior && prior.runId !== runId) throw conflict('Another automation owns this profile');
    this.state.leases[id] = prior ?? { runId, acquiredAt: new Date().toISOString() };
    await this.event('lease.acquired', id);
    return { ...this.state.leases[id], key: leaseKey(this.token, id, runId) };
  }
  async release(id: string) { delete this.state.leases[id]; await this.event('lease.released', id); }
  async event(type: string, profileId: string) {
    this.state.events.push({ cursor: ++this.state.cursor, type, profileId, at: new Date().toISOString() });
    this.state.events = this.state.events.slice(-2000);
    await durableWrite(join(this.directory, 'api-state.json'), JSON.stringify(this.state));
  }
  events(after: number) {
    return { cursor: this.state.cursor, resetRequired: after > this.state.cursor || after < (this.state.events[0]?.cursor ?? 1) - 1, events: this.state.events.filter(event => event.cursor > after) };
  }
}

// Persist admission before performing a mutation. An interrupted admission is quarantined,
// rather than blindly repeating a possibly completed browser or website effect.
export class AdmissionJournal {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {}
  execute<T>(key: string, input: unknown, action: () => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9._-]{8,128}$/.test(key)) return Promise.reject(Object.assign(new Error('Invalid Idempotency-Key'), { status: 400 }));
    const next = this.tail.catch(() => {}).then(async () => {
      const file = join(this.directory, createHash('sha256').update(key).digest('hex') + '.json');
      const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      try {
        const prior = JSON.parse(await readFile(file, 'utf8')) as { digest: string; complete: boolean; result: T };
        if (prior.digest !== digest) throw conflict('Idempotency-Key was already used with a different request');
        if (!prior.complete) throw conflict('Admission was interrupted. Inspect the existing state before submitting a new key.');
        return prior.result;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await durableWrite(file, JSON.stringify({ digest, complete: false }));
      const result = await action();
      await durableWrite(file, JSON.stringify({ digest, complete: true, result }));
      return result;
    });
    this.tail = next; return next;
  }
}
