import { randomUUID } from 'node:crypto';
import type { ProxyChoice } from './types.js';
import { InputVault } from './storage.js';

export interface SavedProxy {
  id: string; name: string; revision: number; createdAt: string; updatedAt: string;
  value: 'http' | 'socks5'; host: string; port: number;
  hasUsername: boolean; hasPassword: boolean;
}
interface Entry { id: string; name: string; revision: number; createdAt: string; updatedAt: string; connection: ProxyChoice }
const inventoryId = 'bd8c2963-f3c5-40cb-a119-409f41045743';
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function validateProxyChoice(value: unknown): ProxyChoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('Invalid proxy connection');
  const p = value as ProxyChoice;
  if (Object.keys(p).some(k => !['value', 'extra'].includes(k)) || !['http','socks5'].includes(p.value) || !p.extra || typeof p.extra !== 'object' || Array.isArray(p.extra)) throw invalid('Invalid proxy connection');
  const e = p.extra;
  if (Object.keys(e).some(k => !['host','port','id','secret'].includes(k)) || typeof e.host !== 'string' || !e.host || e.host.length > 253 || /[\s/@?#\\]/.test(e.host) || !Number.isInteger(e.port) || e.port < 1 || e.port > 65535 || [e.id,e.secret].some(v => v !== undefined && (typeof v !== 'string' || v.length > 4096 || /[\r\n\0]/.test(v)))) throw invalid('Invalid proxy connection');
  if (p.value === 'http' && e.id?.includes(':')) throw invalid('HTTP proxy usernames cannot contain a colon');
  try { new URL(`${p.value}://${e.host.includes(':') && !e.host.startsWith('[') ? '['+e.host+']' : e.host}:${e.port}`); }
  catch { throw invalid('Invalid proxy host'); }
  return structuredClone(p);
}

/** One atomically replaced encrypted inventory; credentials never enter a public index. */
export class ProxyCatalog {
  private entries: Entry[] = [];
  private vault: InputVault;
  constructor(directory: string) { this.vault = new InputVault(directory); }
  async init() {
    await this.vault.init();
    try {
      const state = await this.vault.get<{ version: number; entries: Entry[] }>(inventoryId);
      if (state.version !== 1 || !Array.isArray(state.entries) || state.entries.length > 1000) throw new Error('Invalid saved proxy inventory');
      const ids = new Set<string>();
      for (const entry of state.entries) {
        if (!idPattern.test(entry.id) || ids.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 120 || !Number.isSafeInteger(entry.revision) || entry.revision < 1 || !Number.isFinite(Date.parse(entry.createdAt)) || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error('Invalid saved proxy inventory');
        validateProxyChoice(entry.connection); ids.add(entry.id);
      }
      this.entries = state.entries;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  private entry(id: string) {
    if (!idPattern.test(id)) throw invalid('Invalid saved proxy ID');
    const entry = this.entries.find(x => x.id === id);
    if (!entry) throw Object.assign(new Error('Saved proxy not found'), { status: 404 });
    return entry;
  }
  private public(entry: Entry): SavedProxy {
    const e = entry.connection.extra;
    return { id: entry.id, name: entry.name, revision: entry.revision, createdAt: entry.createdAt, updatedAt: entry.updatedAt, value: entry.connection.value, host: e.host, port: e.port, hasUsername: !!e.id, hasPassword: !!e.secret };
  }
  list() { return this.entries.map(entry => this.public(entry)); }
  connection(id: string, revision?: unknown) {
    const entry = this.entry(id); this.checkRevision(entry, revision);
    return structuredClone(entry.connection);
  }
  private checkRevision(entry: Entry, revision: unknown) {
    if (!Number.isSafeInteger(revision) || Number(revision) < 1) throw invalid('Supply the saved proxy revision');
    if (entry.revision !== revision) throw Object.assign(new Error('Saved proxy changed. Refresh the list before editing or assigning it.'), { status: 412 });
  }
  private async commit(entries: Entry[]) {
    await this.vault.put(inventoryId, { version: 1, entries });
    this.entries = entries;
  }
  async save(data: Record<string, unknown>, id?: string) {
    if (Object.keys(data).some(k => !['name','connection','revision'].includes(k))) throw invalid('Unsupported saved proxy settings');
    const prior = id ? this.entry(id) : undefined;
    if (prior) this.checkRevision(prior, data.revision);
    else if (data.revision !== undefined) throw invalid('New saved proxies have no revision');
    const name = data.name ?? prior?.name;
    if (typeof name !== 'string' || !name.trim() || name.length > 120) throw invalid('Enter a proxy name of up to 120 characters');
    let connection = data.connection === undefined && prior ? structuredClone(prior.connection) : validateProxyChoice(data.connection);
    if (prior && data.connection !== undefined) {
      // Omitted credentials keep existing values; explicit empty strings clear them.
      connection = { ...connection, extra: { ...prior.connection.extra, ...connection.extra } };
      connection = validateProxyChoice(connection);
    }
    if (!prior && this.entries.length >= 1000) throw Object.assign(new Error('Saved proxy inventory is full (1000 connections)'), { status: 409 });
    const now = new Date().toISOString();
    const entry: Entry = { id: id ?? randomUUID(), name: name.trim(), revision: (prior?.revision ?? 0) + 1, createdAt: prior?.createdAt ?? now, updatedAt: now, connection };
    await this.commit([...this.entries.filter(x => x.id !== entry.id), entry]);
    return this.public(entry);
  }
  async remove(id: string, revision: unknown) {
    this.checkRevision(this.entry(id), revision);
    await this.commit(this.entries.filter(x => x.id !== id));
    return { id, removed: true };
  }
}
