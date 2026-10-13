import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { LocalProfile, VesperBrowser } from './browser.js';
import type { ProfileEngine } from './types.js';
import { leaseKey } from './contract.js';

export interface VesperBrowserClientOptions { url: string; tokenFile: string; timeoutMs?: number }

/** Connects automation to one independent Browser-owned profile store. */
export class VesperBrowserClient implements ProfileEngine {
  readonly kind = 'local';
  readonly archiveExtension = '.workbench.tgz';
  private url: URL;
  private owners = new Map<string, string>();
  constructor(private options: VesperBrowserClientOptions) {
    this.url = new URL(options.url);
    if (this.url.protocol !== 'http:' || this.url.hostname !== '127.0.0.1' || !this.url.port || this.url.username || this.url.password || this.url.search || this.url.hash || this.url.pathname !== '/') throw new Error('Vesper Browser service must use an HTTP 127.0.0.1 URL with a port and no credentials or path');
    if (!options.tokenFile) throw new Error('Vesper Browser service requires its private token file');
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1)) throw new Error('Vesper Browser timeout must be positive');
  }
  private route(id: string, action = '') {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error('Invalid Vesper profile ID');
    return `/api/v1/profiles/${id}${action ? `/${action}` : ''}`;
  }
  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    if ((await stat(this.options.tokenFile)).size > 4096) throw new Error('Invalid Browser token file');
    const token = (await readFile(this.options.tokenFile, 'utf8')).trim();
    if (!/^[A-Za-z0-9_-]{43,}$/.test(token)) throw new Error('Invalid Browser token file');
    const id = /^\/api\/v1\/profiles\/([a-f0-9-]{36})/.exec(path)?.[1], owner = id ? this.owners.get(id) : undefined;
    const response = await fetch(new URL(path, this.url), { ...init, headers: { ...init.headers, authorization: `Bearer ${token}`, ...(id && owner ? { 'x-vesper-lease': leaseKey(token, id, owner) } : {}) }, redirect: 'error', signal: AbortSignal.timeout(this.options.timeoutMs ?? 120000) });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      throw Object.assign(new Error(data?.error ?? `Browser service returned ${response.status}`), { status: response.status });
    }
    return response;
  }
  private async json<T>(path: string, method = 'GET', settings?: Record<string, unknown>): Promise<T> {
    return (await this.request(path, { method, ...(settings ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) } : {}) })).json() as Promise<T>;
  }
  async ready() {
    const status = await this.json<{ available: boolean; message: string }>('/api/v1/status');
    if (!status.available) throw Object.assign(new Error(status.message), { status: 503 });
  }
  async identityPresets() { return this.json<typeof import('./identity.js').identityPresets>('/api/v1/identity/presets'); }
  async environmentReport(id: string) { return this.json<Awaited<ReturnType<VesperBrowser['environmentReport']>>>(this.route(id,'environment')); }
  async fingerprintReport(id: string) { return this.json<Awaited<ReturnType<VesperBrowser['fingerprintReport']>>>(this.route(id,'fingerprint')); }
  async installBrowser(): Promise<string> { throw new Error('Install Chromium through the independent Vesper Browser service: vesper-browser install (stop the service first).'); }
  async create(settings: Record<string, unknown>) {
    const runId = typeof settings.name === 'string' ? /^run-([a-f0-9-]{36})$/.exec(settings.name)?.[1] : undefined;
    const response = await this.request('/api/v1/profiles', { method: 'POST', headers: { 'content-type': 'application/json', ...(runId ? { 'x-vesper-run-id': runId, 'idempotency-key': `create-${runId}` } : {}) }, body: JSON.stringify(settings) });
    const profile = await response.json() as { id: string };
    if (runId) this.owners.set(profile.id, runId);
    return profile;
  }
  async capabilities() { return this.json<{ apiVersion: string; capabilities: Record<string, unknown> }>('/api/v1/capabilities'); }
  async listProfiles() { return this.json<LocalProfile[]>('/api/v1/profiles'); }
  async proxies() { return this.json<import('./proxies.js').SavedProxy[]>('/api/v1/proxies'); }
  async saveProxy(data: Record<string, unknown>, id?: string) {
    if (id && !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid saved proxy ID');
    return this.json<import('./proxies.js').SavedProxy>('/api/v1/proxies'+(id?'/'+id:''),id?'PATCH':'POST',data);
  }
  async removeProxy(id: string, revision: number) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid saved proxy ID');
    return this.json<{id:string;removed:boolean}>('/api/v1/proxies/'+id,'DELETE',{revision});
  }
  async assignProxy(id: string, proxyId: string, revision: number) { return this.json<{id:string;proxyId:string;proxyRevision:number;revision:number}>(this.route(id,'proxy'),'POST',{proxyId,revision}); }
  async claimProfile(id: string, runId: string) { await this.json(this.route(id, 'lease'), 'POST', { runId }); this.owners.set(id, runId); }
  async releaseProfile(id: string) { if (this.owners.has(id)) { await this.json(this.route(id, 'lease'), 'DELETE'); this.owners.delete(id); } }
  async readProfile(id: string) { return this.json<LocalProfile>(this.route(id)); }
  async update(id: string, settings: Record<string, unknown>) { await this.json(this.route(id), 'PATCH', settings); }
  async install(id: string) { await this.json(this.route(id, 'install'), 'POST'); }
  async start(id: string) { await this.json(this.route(id, 'start'), 'POST'); }
  async stop(id: string) { await this.json(this.route(id, 'stop'), 'POST'); }
  async duplicate(id: string) { return this.json<{ id: string }>(this.route(id, 'duplicate'), 'POST'); }
  async trash(id:string,restore=false){return this.json(this.route(id,restore?'restore':'trash'),'POST');}
  async environment(id:string){return this.json<Record<string,unknown>>(this.route(id,'environment'));}
  async fingerprintCapabilities(){return this.json<Record<string,unknown>>('/api/v1/fingerprint/capabilities');}
  async fingerprint(id:string){return this.json<Record<string,unknown>>(this.route(id,'fingerprint'));}
  async cookies(id:string,values?:unknown[]){return this.json<unknown[]>(this.route(id,'cookies'),values?'POST':'GET',values?{cookies:values}:undefined);}
  async extensions(){return this.json<import('./extensions.js').BrowserExtension[]>('/api/v1/extensions');}
  async removeExtension(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid extension package ID');return this.json<{id:string;removed:boolean}>('/api/v1/extensions/'+id,'DELETE');}
  async profileExtensions(id:string){return this.json<import('./extensions.js').BrowserExtension[]>(this.route(id,'extensions'));}
  async importExtension(file:string){
    if((await stat(file)).size>40*1024**2)throw new Error('Extension ZIP exceeds 40 MiB');
    const stream=createReadStream(file);
    try{const response=await this.request('/api/v1/extensions/import',{method:'POST',headers:{'content-type':'application/zip'},body:stream as unknown as BodyInit,duplex:'half'} as RequestInit);return response.json() as Promise<import('./extensions.js').BrowserExtension>;}
    finally{stream.destroy();}
  }
  async templates(){return this.json<import('./catalog.js').ProfileTemplate[]>('/api/v1/templates');}
  async saveTemplate(name:string,settings:Record<string,unknown>){return this.json<import('./catalog.js').ProfileTemplate>('/api/v1/templates','POST',{name,settings});}
  async engineVersions(){return this.json<Record<string,unknown>>('/api/v1/engine/versions');}
  async stageNativeKernel(executablePath:string){return this.json<Record<string,unknown>>('/api/v1/engine/native/stage','POST',{executablePath});}
  async stageEngine(buildId:string,family:'chromium'|'brave'|'vesper'='chromium'){return this.json<Record<string,unknown>>('/api/v1/engine/stage','POST',{buildId,family});}
  async qualifyEngine(buildId:string,family:'chromium'|'brave'|'vesper'='chromium'){return this.json<import('./engine-canary.js').EngineCanaryReport | import('./native-kernel.js').NativeKernelReport>('/api/v1/engine/qualify','POST',{buildId,family});}
  async activateEngine(buildId:string,family:'chromium'|'brave'|'vesper'='chromium'){return this.json<Record<string,unknown>>('/api/v1/engine/activate','POST',{buildId,family});}
  async connectionUrl(id: string) {
    const { endpoint } = await this.json<{ endpoint: string }>(this.route(id, 'connection'));
    const url = new URL(endpoint);
    if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || !url.port || !url.pathname.startsWith('/devtools/browser/')) throw new Error('Browser service returned an invalid local CDP endpoint');
    return endpoint;
  }
  async versions(id: string) { return this.json<{ engineVersion: string; kernelVersion: string }>(this.route(id, 'versions')); }
  async findByRunId(runId: string) { const found = (await this.listProfiles()).find(profile => profile.name === `run-${runId}`); if (found) await this.claimProfile(found.id, runId); return found; }
  async export(id: string, file: string) {
    const destination = resolve(file); await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    const handle = await open(destination, 'wx', 0o600);
    try {
      const response = await this.request(this.route(id, 'archive'));
      if (!response.body || response.headers.get('content-type') !== 'application/gzip') throw new Error('Browser service did not return a profile archive');
      let bytes = 0;
      const limiter = new Transform({ transform(chunk: Buffer, _encoding, done) { bytes += chunk.length; done(bytes > 2 * 1024 ** 3 ? new Error('Profile archive exceeds 2 GiB') : null, chunk); } });
      await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), limiter, handle.createWriteStream());
    } catch (failure) { await handle.close().catch(() => {}); await rm(destination, { force: true }); throw failure; }
  }
  async importProfile(file: string, overrides: Record<string, unknown> = {}) {
    if (Object.keys(overrides).length) throw new Error('Import overrides are unavailable through the Browser service; edit the imported profile afterward.');
    if ((await stat(file)).size > 512 * 1024 ** 2) throw new Error('Profile upload exceeds 512 MiB');
    const stream = createReadStream(file);
    try {
      const response = await this.request('/api/profiles/import', { method: 'POST', headers: { 'content-type': 'application/gzip' }, body: stream as unknown as BodyInit, duplex: 'half' } as RequestInit);
      return response.json() as Promise<{ id: string }>;
    } finally { stream.destroy(); }
  }
  // Releasing an automation client never shuts down the shared Browser owner.
  async close() {}
}
