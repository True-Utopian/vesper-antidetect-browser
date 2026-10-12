import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { vesperBrowserVersion } from './version.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, rm, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { join } from 'node:path';
import { VesperBrowser } from './browser.js';
import { AdmissionJournal, BrowserContract, apiVersion, capabilities, conflict } from './contract.js';
import { browserOpenApi } from './openapi.js';
import { ProfileCatalog } from './catalog.js';
import { environmentCapabilities } from './persona.js';
import { fingerprintCapabilities } from './native-preferences.js';

export async function browserAccessToken(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, 'admin-token');
  let token: string;
  try { token = (await readFile(file, 'utf8')).trim(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    token = randomBytes(32).toString('base64url');
    const handle = await open(file, 'wx', 0o600);
    try { await handle.writeFile(token); await handle.sync(); } finally { await handle.close(); }
  }
  if (!/^[A-Za-z0-9_-]{43,}$/.test(token)) throw new Error('Invalid Browser access token file');
  return token;
}

const idPattern = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const error = (status: number, message: string) => Object.assign(new Error(message), { status });
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'application/javascript; charset=utf-8']],
  ['/usability.css', ['usability.css', 'text/css; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/desktop-theme.css', ['desktop-theme.css', 'text/css; charset=utf-8']],
  ['/vesper-icon.png', ['vesper-icon.png', 'image/png']],
  ['/vesper-mark.svg', ['vesper-mark.svg', 'image/svg+xml']],
  ['/vesper-icons.svg', ['vesper-icons.svg', 'image/svg+xml']],
]);
function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data));
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw error(415, 'Send settings as application/json.');
  if (Number(request.headers['content-length'] ?? 0) > 65536) { request.resume(); throw error(413, 'Settings exceed 64 KiB.'); }
  const chunks: Buffer[] = [];
  await new Promise<void>((done, reject) => {
    let size = 0;
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > 65536) { request.off('data', data); request.resume(); reject(error(413, 'Settings exceed 64 KiB.')); return; }
      chunks.push(chunk);
    };
    request.on('data', data); request.once('end', done); request.once('error', reject);
  });
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw error(400, 'Settings must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw error(400, 'Settings must be a JSON object.');
  return value as Record<string, unknown>;
}

/** Independent loopback profile manager. The caller owns engine shutdown. */
export async function createBrowserServer(browser: VesperBrowser, token: string, options: { shutdown?: () => Promise<void> } = {}) {
  if (!/^[A-Za-z0-9_-]{43,}$/.test(token)) throw new Error('Browser manager requires a strong private access token');
  const assetRoot = new URL('../public/', import.meta.url);
  await browser.listProfiles(); // Acquire the profile-store owner before opening its API journal.
  const contract = new BrowserContract(browser.storeDirectory, token); await contract.init();
  const admissions = new AdmissionJournal(join(browser.storeDirectory, 'admissions'));
  const catalog = new ProfileCatalog(browser.storeDirectory, settings => browser.validateSettings(settings)); await catalog.init();
  const server = createServer((request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
    const dispatch = async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      url.pathname = url.pathname.replace(/^\/api\/v1\//, '/api/');
      const asset = assets.get(url.pathname);
      if (request.method === 'GET' && asset) {
        response.setHeader('content-type', asset[1]!); response.end(await readFile(new URL(asset[0]!, assetRoot))); return;
      }
      if (!url.pathname.startsWith('/api/')) throw error(404, 'Page not found.');
      const address = server.address();
      if (!address || typeof address === 'string') throw error(503, 'Browser manager is not listening.');
      const allowed = [`http://127.0.0.1:${address.port}`, `http://localhost:${address.port}`];
      if (request.headers.origin && !allowed.includes(request.headers.origin)) throw error(403, 'Origin is not allowed.');
      if (!['GET', 'HEAD'].includes(request.method ?? '') && request.headers['sec-fetch-site'] === 'cross-site') throw error(403, 'Cross-site writes are not allowed.');
      const presented = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const expected = Buffer.from(token), candidate = Buffer.from(presented);
      if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) throw error(401, 'Enter the Browser access token.');
      if (url.pathname === '/api/service/shutdown' && request.method === 'POST' && options.shutdown) {
        if (request.headers.origin) throw error(403, 'Desktop shutdown is available only through the native manager');
        json(response, 202, { stopping: true }); setImmediate(() => void options.shutdown!()); return;
      }
      if (url.pathname === '/api/capabilities' && request.method === 'GET') { json(response, 200, { product: 'Vesper Browser', author: 'true-utopian', version: vesperBrowserVersion, apiVersion, capabilities }); return; }
      if (url.pathname === '/api/session' && request.method === 'GET') { json(response, 200, { authenticated: true }); return; }
      if (url.pathname === '/api/openapi.json' && request.method === 'GET') { json(response, 200, browserOpenApi); return; }
      if (url.pathname === '/api/environment/capabilities' && request.method === 'GET') { json(response, 200, environmentCapabilities); return; }
      if (url.pathname === '/api/fingerprint/capabilities' && request.method === 'GET') { json(response, 200, fingerprintCapabilities); return; }
      if (url.pathname === '/api/engine/versions' && request.method === 'GET') { json(response,200,await browser.engineVersions()); return; }
      if (url.pathname === '/api/proxies') {
        if (request.method === 'GET') { json(response,200,await browser.proxies()); return; }
        if (request.method === 'POST') { json(response,201,await browser.saveProxy(await body(request))); return; }
      }
      const savedProxy = new RegExp(`^/api/proxies/(${idPattern})$`).exec(url.pathname);
      if (savedProxy) {
        if (request.method === 'PATCH') { json(response,200,await browser.saveProxy(await body(request), savedProxy[1]!)); return; }
        if (request.method === 'DELETE') { const data = await body(request); json(response,200,await browser.removeProxy(savedProxy[1]!,data.revision)); return; }
        throw error(405,'Method not allowed.');
      }
      if(url.pathname==='/api/extensions' && request.method==='GET'){json(response,200,await browser.extensions());return;}
      const extension = /^\/api\/extensions\/([a-f0-9]{64})$/.exec(url.pathname);
      if(extension && request.method==='DELETE'){json(response,200,await browser.removeExtension(extension[1]!));return;}
      if(url.pathname==='/api/extensions/import' && request.method==='POST'){
        if(request.headers['content-type']?.split(';')[0]!=='application/zip')throw error(415,'Upload an unpacked extension ZIP as application/zip');
        if(Number(request.headers['content-length']??0)>40*1024**2){request.resume();throw error(413,'Extension ZIP exceeds 40 MiB');}
        const temporary=await mkdtemp(join(tmpdir(),'vesper-extension-import-'));
        try{let bytes=0;const file=join(temporary,'extension.zip');await pipeline(request,new Transform({transform(chunk:Buffer,_encoding,done){bytes+=chunk.length;done(bytes>40*1024**2?error(413,'Extension ZIP exceeds 40 MiB'):null,chunk);}}),createWriteStream(file,{flags:'wx',mode:0o600}));json(response,201,await browser.installExtension(file));}
        finally{await rm(temporary,{recursive:true,force:true});}
        return;
      }
      if(url.pathname==='/api/engine/native/stage' && request.method==='POST'){const data=await body(request);if(typeof data.executablePath!=='string')throw error(400,'Choose a compiled native kernel executable');json(response,200,await browser.stageNativeKernel(data.executablePath));return;}
      if (['/api/engine/stage','/api/engine/qualify','/api/engine/activate'].includes(url.pathname) && request.method === 'POST') {
        const data = await body(request); if (typeof data.buildId !== 'string') throw error(400,'Enter a pinned Chromium revision');
        if(data.family!==undefined&&(typeof data.family !== 'string'||!['chromium','brave','vesper'].includes(data.family)))throw error(400,'Invalid browser engine');const family=data.family==='brave'?'brave':data.family==='vesper'?'vesper':'chromium';
        const assertOwnership = async () => { if ((await browser.listProfiles(true)).some(x => contract.lease(x.id))) throw conflict('Release run ownership before activating an engine update'); };
        json(response,200,url.pathname.endsWith('/stage') ? await browser.stageEngine(data.buildId,family) : url.pathname.endsWith('/qualify') ? await browser.qualifyEngine(data.buildId,family) : await browser.activateEngine(data.buildId,family,assertOwnership)); return;
      }
      if (url.pathname === '/api/templates') {
        if (request.method === 'GET') { json(response,200,catalog.list()); return; }
        if (request.method === 'POST') { const data = await body(request); json(response,201,await catalog.save(data.name,data.settings)); return; }
      }
      const template = new RegExp(`^/api/templates/(${idPattern})(?:/(create-profile))?$`).exec(url.pathname);
      if (template) {
        if (request.method === 'GET') { json(response,200,catalog.get(template[1]!)); return; }
        const data = await body(request);
        if (request.method === 'PATCH' && !template[2]) { json(response,200,await catalog.save(data.name,data.settings,template[1])); return; }
        if (request.method === 'POST' && template[2]) { json(response,201,await browser.create({ ...catalog.get(template[1]!).settings, ...data })); return; }
      }
      if (url.pathname === '/api/profiles/bulk' && request.method === 'POST') {
        const data = await body(request);
        if (!Array.isArray(data.ids) || data.ids.length > 50 || !data.ids.length || data.ids.some(id => typeof id !== 'string' || !new RegExp(`^${idPattern}$`).test(id)) || !['start','stop','trash','restore','duplicate'].includes(String(data.action))) throw error(400,'Select up to 50 profiles and a supported action');
        for (const id of data.ids) contract.assertAccess(id, request.headers['x-vesper-lease'] as string | undefined);
        const ids=data.ids as string[]; const execute = async () => { const results = [];
        for (const id of ids) { try {
          const result = data.action === 'trash' || data.action === 'restore' ? await browser.trash(id,data.action === 'restore') : data.action === 'duplicate' ? await browser.duplicate(id) : data.action === 'start' ? await browser.start(id) : await browser.stop(id);
          await contract.event(`profile.${data.action}`,id); results.push({ id, ok: true, result });
        } catch (failure) { results.push({ id, ok: false, error: (failure as Error).message }); } }
        return {results}; }; const key=request.headers['idempotency-key'];
        json(response,200,typeof key==='string'?await admissions.execute(key,{operation:'bulk',...data},execute):await execute()); return;
      }
      if (url.pathname === '/api/events' && request.method === 'GET') {
        const after = Number(url.searchParams.get('after') ?? 0);
        if (!Number.isSafeInteger(after) || after < 0) throw error(400, 'Event cursor must be a nonnegative integer');
        json(response, 200, contract.events(after)); return;
      }
      if (url.pathname === '/api/browser/install' && request.method === 'POST') { await browser.installBrowser(); json(response, 200, { installed: true }); return; }
      if (url.pathname === '/api/status' && request.method === 'GET') {
        let available = true, message = 'Chromium is ready.';
        try { await browser.ready(); } catch (failure) { available = false; message = (failure as Error).message; }
        json(response, 200, { product: 'Vesper Browser', author: 'true-utopian', available, message }); return;
      }
      if (url.pathname === '/api/profiles') {
        if (request.method === 'GET') { json(response, 200, (await browser.listProfiles(url.searchParams.get('trash') === '1')).filter(profile => url.searchParams.get('trash') !== '1' || profile.trashedAt).map(profile => ({ ...profile, lease: contract.lease(profile.id) }))); return; }
        if (request.method === 'POST') {
          const settings = await body(request), runId = request.headers['x-vesper-run-id'];
          if (runId && (typeof runId !== 'string' || !/^[a-f0-9-]{36}$/.test(runId))) throw error(400, 'Invalid automation run ID');
          const create = async () => {
            const profile = await browser.create(settings);
            if (typeof runId === 'string') await contract.acquire(profile.id, runId);
            await contract.event('profile.created', profile.id); return profile;
          };
          const key = request.headers['idempotency-key'];
          json(response, 201, typeof key === 'string' ? await admissions.execute(key, { settings, runId }, create) : await create()); return;
        }
      }
      if (url.pathname === '/api/profiles/import' && request.method === 'POST') {
        if (request.headers['content-type']?.split(';')[0] !== 'application/gzip') throw error(415, 'Upload a profile archive as application/gzip.');
        if (Number(request.headers['content-length'] ?? 0) > 512 * 1024 ** 2) { request.resume(); throw error(413, 'Profile upload exceeds 512 MiB.'); }
        const temporary = await mkdtemp(join(tmpdir(), 'vesper-profile-import-'));
        try {
          let bytes = 0;
          const limiter = new Transform({ transform(chunk: Buffer, _encoding, done) { bytes += chunk.length; done(bytes > 512 * 1024 ** 2 ? error(413, 'Profile upload exceeds 512 MiB.') : null, chunk); } });
          const file = join(temporary, 'profile.workbench.tgz');
          await pipeline(request, limiter, createWriteStream(file, { flags: 'wx', mode: 0o600 }));
          json(response, 201, await browser.importProfile(file));
        } finally { await rm(temporary, { recursive: true, force: true }); }
        return;
      }
      const match = new RegExp(`^/api/profiles/(${idPattern})(?:/(start|stop|duplicate|install|connection|versions|archive|lease|interrupt|trash|restore|environment|cookies|fingerprint|extensions|proxy))?$`).exec(url.pathname);
      if (!match) throw error(404, 'Profile route not found.');
      const id = match[1]!, action = match[2];
      if (action === 'interrupt' && request.method === 'POST') {
        await browser.stop(id); await contract.release(id); json(response, 200, { id, interrupted: true }); return;
      }
      if (action === 'lease' && request.method === 'POST') {
        if (browser.engineBusy) throw conflict('Engine activation is in progress; retry after it completes');
        await browser.readProfile(id);
        if ((await browser.listProfiles()).find(profile => profile.id === id)?.state === 'running' && !contract.lease(id)) throw conflict('Stop the manually opened profile before acquiring its lease');
        const settings = await body(request);
        if (browser.engineBusy) throw conflict('Engine activation is in progress; retry after it completes');
        json(response, 200, await contract.acquire(id, String(settings.runId ?? ''))); return;
      }
      if (!['GET', 'HEAD'].includes(request.method ?? '') || ['connection', 'archive','cookies','environment'].includes(action ?? '')) contract.assertAccess(id, request.headers['x-vesper-lease'] as string | undefined);
      if (action === 'proxy' && request.method === 'POST') {
        const data = await body(request);
        if (Object.keys(data).some(k => !['proxyId','revision'].includes(k)) || typeof data.proxyId !== 'string') throw error(400,'Choose a saved proxy and its current revision');
        const result = await browser.assignProxy(id,data.proxyId,data.revision);
        await contract.event('profile.proxy-assigned',id); json(response,200,result); return;
      }
      if (action === 'cookies' && request.method === 'POST') { const data = await body(request); if(!Array.isArray(data.cookies)) throw error(400,'Supply a cookies array'); json(response,200,await browser.cookies(id,data.cookies)); return; }
      if (action === 'lease' && request.method === 'DELETE') {
        if ((await browser.listProfiles()).find(profile => profile.id === id)?.state === 'running') throw conflict('Stop the profile before releasing its lease');
        await contract.release(id); json(response, 200, { id }); return;
      }
      if (request.method === 'GET') {
        if(action==='extensions'){json(response,200,await browser.profileExtensions(id));return;}
        if (action === 'environment') { json(response,200,await browser.environmentReport(id)); return; }
        if (action === 'fingerprint') { json(response,200,await browser.fingerprintReport(id)); return; }
        if (action === 'cookies') { json(response,200,await browser.cookies(id)); return; }
        if (!action) { const profile = await browser.readProfile(id); response.setHeader('etag', `"${profile.revision ?? 1}"`); json(response, 200, { ...profile, lease: contract.lease(id) }); return; }
        if (action === 'connection') { json(response, 200, { endpoint: await browser.connectionUrl(id) }); return; }
        if (action === 'versions') { json(response, 200, await browser.versions(id)); return; }
        if (action === 'archive') {
          const temporary = await mkdtemp(join(tmpdir(), 'vesper-profile-export-'));
          try {
            const file = join(temporary, 'profile.workbench.tgz');
            await browser.export(id, file);
            response.writeHead(200, { 'content-type': 'application/gzip', 'content-length': (await stat(file)).size, 'content-disposition': `attachment; filename="${id}.workbench.tgz"` });
            await pipeline(createReadStream(file), response);
          } finally { await rm(temporary, { recursive: true, force: true }); }
          return;
        }
      }
      if (!action && request.method === 'PATCH') {
        const revision = (await browser.readProfile(id)).revision ?? 1;
        if (request.headers['if-match'] && request.headers['if-match'] !== `"${revision}"`) throw error(412, 'Profile changed. Read its current revision before editing.');
        await browser.update(id, await body(request)); await contract.event('profile.updated', id); json(response, 200, { id, revision: revision + 1 }); return;
      }
      if (action && ['start', 'stop', 'duplicate', 'install','trash','restore'].includes(action) && request.method === 'POST') {
        // Actions have no request body; reject unexpected payloads without retaining them.
        if (Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding']) { request.resume(); throw error(400, 'This action takes no settings.'); }
        if (action === 'install') await browser.install(id);
        else if (action === 'start') await browser.start(id);
        else if (action === 'stop') await browser.stop(id);
        else if (action === 'trash' || action === 'restore') await browser.trash(id,action === 'restore');
        else { json(response, 201, await browser.duplicate(id)); return; }
        await contract.event(`profile.${action}`, id); json(response, 200, { id }); return;
      }
      throw error(405, 'Method not allowed.');
    };
    void (request.method === 'GET' ? dispatch() : contract.serial(dispatch)).catch(failure => {
      const typed = failure as Error & { status?: number; code?: string };
      const status = typed.status ?? (typed.code === 'ENOENT' ? 404 : /already running|capacity|Stop the profile|Restore the profile|owns this/.test(typed.message) ? 409 : /Invalid|Unsupported|requires local/.test(typed.message) ? 400 : 500);
      if (!response.headersSent) json(response, status, { error: typed.message, code: status === 409 ? 'conflict' : status === 412 ? 'revision_conflict' : status === 401 ? 'unauthorized' : 'operation_failed' }); else response.end();
    });
  });
  server.requestTimeout = 30000;
  return server;
}
