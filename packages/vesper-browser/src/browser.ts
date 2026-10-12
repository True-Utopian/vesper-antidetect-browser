import {cookieSnapshot,validateCookies} from './cookies.js';
import { vesperBrowserVersion } from './version.js';
import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import puppeteer, { type Browser as PuppeteerBrowser } from 'puppeteer-core';
import { Browser, detectBrowserPlatform, install, resolveBuildId } from '@puppeteer/browsers';
import { Server as ProxyServer } from 'proxy-chain';
import * as tar from 'tar';
import type { ProfileEngine, ProxyChoice } from './types.js';
import { InputVault, durableWrite } from './storage.js';
import { ProxyCatalog, validateProxyChoice } from './proxies.js';
import { acquireProcessLock } from './process-lock.js';
import { validateEnvironment, environmentArguments, type EnvironmentPolicy } from './persona.js';
import { prepareNativePreferences, validateFingerprint, fingerprintCapabilities, type FingerprintPolicy } from './native-preferences.js';
import { TargetPolicy } from './target-policy.js';
import { createPolicyGateway } from './cdp-gateway.js';
import { installBrave } from './brave.js';
import { EngineCanaryError, qualifyEngineCandidate } from './engine-canary.js';
import { type EngineFamily, nativeExecutableHash, nativeProfileArguments, nativeRuntimeInventory, verifyNativeRuntime, assertNativeSurfacePolicies } from './native-kernel.js';
import { ExtensionStore, validateExtensionIds } from './extensions.js';
import { extensionLaunchPaths, profileLaunchPath } from './extension-launch.js';
import { qualifyNativeKernel } from './native-qualification.mjs';


export interface LocalProfileSettings {
  name?: string; storage?: 'local'; proxy?: ProxyChoice;
  savedProxy?: { id: string; revision: number };
  locale?: string; timezone?: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
  folder?: string; tags?: string[]; notes?: string; status?: string; favorite?: boolean;
  startPages?: string[]; environment?: EnvironmentPolicy;
  engine?: EngineFamily;
  fingerprint?: FingerprintPolicy;
  extensions?: string[];
}
export interface LocalProfile {
  id: string; name: string; createdAt: string; settings: Omit<LocalProfileSettings, 'proxy' | 'savedProxy'>;
  hasProxy: boolean; revision?: number; browserVersion?: string; state?: 'running' | 'stopped'; trashedAt?: string;
}
interface Session { pid: number; endpoint: string; nativeEndpoint?: string }
interface Live { browser: PuppeteerBrowser; proxy?: ProxyServer; policy: TargetPolicy; gateway: Awaited<ReturnType<typeof createPolicyGateway>>; extensionCleanup: () => Promise<void> }
export interface LocalEngineOptions { directory: string; executablePath?: string; headless?: boolean; buildId?: string; maxConcurrency?: number }
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const isAlive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') return false; throw e; } };
const cacheNames = new Set(['Cache', 'Code Cache', 'GPUCache', 'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache', 'DawnCache', 'Crashpad', 'BrowserMetrics', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort', 'component_crx_cache', 'SODA', 'SODALanguagePacks']);

/** Original Vesper Browser profile engine. Uses standard Chromium with explicit profile settings. */
export class VesperBrowser implements ProfileEngine {
  readonly kind = 'local';
  readonly archiveExtension = '.workbench.tgz';
  private directory: string;
  private vault: InputVault;
  private extensionStore: ExtensionStore;
  private proxyCatalog: ProxyCatalog;
  private initialized?: Promise<void>;
  private live = new Map<string, Live>();
  private operations = new Map<string, Promise<unknown>>();
  private ownerId = randomUUID();
  private closed = false;
  private installation?: Promise<string>;
  private starts = Promise.resolve();
  private engineMaintenance = false;
  get engineBusy() { return this.engineMaintenance; }
  private unlock?: () => Promise<void>;
  constructor(private options: LocalEngineOptions) {
    if (options.maxConcurrency !== undefined && (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1)) throw new Error('Local browser capacity must be a positive integer');
    this.directory = resolve(options.directory);
    this.vault = new InputVault(join(this.directory, 'secrets'));
    this.extensionStore = new ExtensionStore(join(this.directory,'extensions'));
    this.proxyCatalog = new ProxyCatalog(join(this.directory, 'proxy-inventory'));
  }
  get storeDirectory() { return this.directory; }
  private profileDir(id: string) { if (!idPattern.test(id)) throw new Error('Invalid local profile ID'); return join(this.directory, 'profiles', id); }
  private serial<T>(id: string, action: () => Promise<T>, maintenanceAllowed = false): Promise<T> {
    if (this.engineMaintenance && !maintenanceAllowed) return Promise.reject(Object.assign(new Error('Engine activation is in progress; retry after it completes'), { status: 409 }));
    const prior = this.operations.get(id) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(action); this.operations.set(id, next);
    void next.finally(() => { if (this.operations.get(id) === next) this.operations.delete(id); }).catch(() => {});
    return next;
  }
  private init() {
    if (this.closed) throw new Error('Local engine is closed');
    return this.initialized ??= (async () => {
      await mkdir(join(this.directory, 'profiles'), { recursive: true, mode: 0o700 });
      const lock = join(this.directory, 'owner.json');
      // Check active owners immediately; stale cleanup happens only under the atomic lock.
      try {
        const prior = JSON.parse(await readFile(lock, 'utf8')) as { pid: number };
        if (Number.isSafeInteger(prior.pid) && prior.pid > 0 && isAlive(prior.pid)) throw new Error('Another Vesper Browser process owns this profile store.');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      this.unlock = await acquireProcessLock(this.directory, () => { void this.close().catch(() => {}); });
      try {
        const prior = JSON.parse(await readFile(lock, 'utf8')) as { pid: number };
        if (!Number.isSafeInteger(prior.pid) || prior.pid < 1 || isAlive(prior.pid)) throw new Error('Another Vesper Browser process owns this profile store. Stop it before opening these profiles.');
        await rm(lock);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const handle = await open(lock, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify({ pid: process.pid, ownerId: this.ownerId })); } finally { await handle.close(); }
      await this.vault.init();
      await this.proxyCatalog.init();
    })();
  }
  private async executable(family: EngineFamily = 'chromium', fingerprint?: FingerprintPolicy): Promise<string> {
    let selected: { executablePath: string } | undefined;
    try { selected = JSON.parse(await readFile(join(this.directory,family==='brave'?'selected-brave.json':family==='vesper'?'selected-native-kernel.json':'selected-browser.json'),'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (selected) { await access(selected.executablePath); if(family==='vesper'){const native=selected as { executablePath:string; qualification?:import('./native-kernel.js').NativeKernelReport; runtimeFiles:import('./native-kernel.js').NativeRuntimeFile[] };if(native.qualification?.nativeProof!==true||native.qualification.state!=='passed'||await nativeExecutableHash(native.executablePath)!==native.qualification.executableSha256)throw new Error('Native kernel changed or lacks direct native qualification; stage and test it again');await verifyNativeRuntime(native.executablePath,native.runtimeFiles);assertNativeSurfacePolicies(native.qualification,fingerprint);}return selected.executablePath; }
    if(family==='vesper')throw new Error('Stage, test and activate a compiled Vesper kernel under Browser engines first');
    if (family === 'brave') throw new Error('Stage and activate a Brave privacy engine under Engine updates before using this profile');
    if (this.options.executablePath) { const file = resolve(this.options.executablePath); await access(file); return file; }
    try {
      const cached = JSON.parse(await readFile(join(this.directory, 'browser.json'), 'utf8')) as { executablePath: string; buildId: string };
      if (this.options.buildId && cached.buildId !== this.options.buildId) throw new Error('Browser revision changed');
      await access(cached.executablePath); return cached.executablePath;
    } catch { throw new Error('Chromium is not installed. Run vesper-browser install, or supply executablePath.'); }
  }
  async installBrowser(): Promise<string> {
    await this.init();
    if (this.options.executablePath) return this.executable();
    return this.installation ??= (async () => {
      const platform = detectBrowserPlatform(); if (!platform) throw new Error('Unsupported Chromium platform');
      const buildId = this.options.buildId ?? await resolveBuildId(Browser.CHROMIUM, platform, 'latest');
      const browser = await install({ browser: Browser.CHROMIUM, platform, buildId, cacheDir: join(this.directory, 'browsers') });
      await durableWrite(join(this.directory, 'browser.json'), JSON.stringify({ buildId, executablePath: browser.executablePath }));
      return browser.executablePath;
    })().catch(error => { this.installation = undefined; throw error; });
  }
  async extensions() { return this.serial('extension-catalog',async()=>{await this.init();return this.extensionStore.list();}); }
  async installExtension(file:string) { return this.serial('extension-catalog',async()=>{await this.init();return this.extensionStore.installZip(file);}); }
  async removeExtension(id:string) {
    return this.serial('extension-catalog',async()=>{
      validateExtensionIds([id]);
      const assigned=(await this.listProfiles(true)).filter(profile=>profile.settings.extensions?.includes(id));
      if(assigned.length)throw Object.assign(new Error(`Remove this extension from ${assigned.length} assigned profile${assigned.length===1?'':'s'} first, including profiles in the trash.`),{status:409});
      await this.extensionStore.remove(id);
      return {id,removed:true};
    });
  }
  async profileExtensions(id:string) { return this.serial(id,async()=>{const profile=await this.readProfile(id);return this.extensionStore.describe(join(this.profileDir(id),'browser'),profile.settings.extensions??[]);}); }
  async ready() { await this.init(); await this.executable(); }
  async proxies() { return this.serial('extension-catalog', async () => { await this.init(); return this.proxyCatalog.list(); }); }
  async saveProxy(data: Record<string, unknown>, id?: string) { return this.serial('extension-catalog', async () => { await this.init(); return this.proxyCatalog.save(data, id); }); }
  async removeProxy(id: string, revision: unknown) { return this.serial('extension-catalog', async () => { await this.init(); return this.proxyCatalog.remove(id, revision); }); }
  async assignProxy(id: string, proxyId: string, revision: unknown) {
    return this.serial('extension-catalog', () => this.serial(id, async () => {
      await this.init();
      const proxy = this.proxyCatalog.connection(proxyId, revision);
      await this.updateUnlocked(id, { proxy });
      return { id, proxyId, proxyRevision: revision, revision: (await this.readProfile(id)).revision };
    }));
  }
  async stageNativeKernel(executablePath: string) {
    return this.serial('engine', async () => {
      await this.init();
      const file = resolve(executablePath);
      if (!(await stat(file)).isFile()) throw new Error('Native kernel executable must be a local file');
      const sha256 = await nativeExecutableHash(file), buildId = `native-${sha256.slice(0, 16)}`;
      const state = await this.engineVersions();
      const entry = { family: 'vesper', buildId, executablePath: file, stagedAt: new Date().toISOString(), executableSha256: sha256, runtimeFiles: await nativeRuntimeInventory(file) };
      state.staged = [...state.staged.filter((x: { family?: string; buildId: string }) => !(x.family === 'vesper' && x.buildId === buildId)), entry];
      delete state.activeExecutable;
      await durableWrite(join(this.directory, 'engine-updates.json'), JSON.stringify(state));
      return entry;
    });
  }
  async engineVersions() { await this.init(); return { activeExecutable: await this.executable().catch(() => undefined), ...(await readFile(join(this.directory,'engine-updates.json'),'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return { staged: [] }; })) }; }
  async stageEngine(buildId: string, family: EngineFamily = 'chromium') {
    return this.serial('engine', () => this.stageEngineUnlocked(buildId, family));
  }
  private async stageEngineUnlocked(buildId: string, family: EngineFamily) {
    await this.init(); if(family==='vesper')throw new Error('Use local native-kernel staging with a compiled executable path'); if (family==='chromium' && !/^[0-9]{5,10}$/.test(buildId)) throw new Error('Invalid Chromium revision');
    if(family==='brave'){const installed=await installBrave(join(this.directory,'browsers'),buildId),state=await this.engineVersions();state.staged=[...(state.staged??[]).filter((x:{buildId:string;family?:string})=>!(x.family==='brave'&&x.buildId===buildId)),installed];delete state.activeExecutable;await durableWrite(join(this.directory,'engine-updates.json'),JSON.stringify(state));return installed;}
    const platform = detectBrowserPlatform(); if (!platform) throw new Error('Unsupported Chromium platform');
    const installed = await install({ browser: Browser.CHROMIUM, platform, buildId, cacheDir: join(this.directory,'browsers') });
    const state = await this.engineVersions(); state.staged = [...(state.staged ?? []).filter((entry: { buildId: string; family?: string }) => !(entry.buildId === buildId && entry.family!=='brave')), { family:'chromium', buildId, executablePath: installed.executablePath, stagedAt: new Date().toISOString() }];
    delete state.activeExecutable; await durableWrite(join(this.directory,'engine-updates.json'),JSON.stringify(state)); return { buildId, executablePath: installed.executablePath };
  }
  async qualifyEngine(buildId: string, family: EngineFamily = 'chromium') {
    return this.serial('engine', () => this.qualifyEngineUnlocked(buildId, family));
  }
  private async qualifyEngineUnlocked(buildId: string, family: EngineFamily) {
    const state = await this.engineVersions(), entry = state.staged.find((x: { buildId: string; family?: string }) => x.buildId === buildId && (x.family ?? 'chromium') === family);
    if (!entry) throw new Error('Stage this engine build before qualification');
    try {
      if(family==='vesper'){await verifyNativeRuntime(entry.executablePath,entry.runtimeFiles);entry.qualification=await qualifyNativeKernel(entry.executablePath);await verifyNativeRuntime(entry.executablePath,entry.runtimeFiles);if(!entry.qualification.nativeProof){delete state.activeExecutable;await durableWrite(join(this.directory,'engine-updates.json'),JSON.stringify(state));throw new Error('Native kernel proof failed: '+entry.qualification.errors.join('; '));}}
      else entry.qualification = await qualifyEngineCandidate({ family, buildId, executablePath: entry.executablePath }, options => new VesperBrowser(options));
    } catch (error) {
      if (error instanceof EngineCanaryError) {
        entry.qualification = error.report;
        delete state.activeExecutable; await durableWrite(join(this.directory, 'engine-updates.json'), JSON.stringify(state));
      }
      throw error;
    }
    delete state.activeExecutable; await durableWrite(join(this.directory, 'engine-updates.json'), JSON.stringify(state));
    return entry.qualification;
  }
  async activateEngine(buildId: string, family: EngineFamily = 'chromium', assertOwnership?: () => Promise<void>) {
    return this.serial('engine', async () => {
      this.engineMaintenance = true;
      try {
        await this.starts.catch(() => {});
        await Promise.all([...this.operations.entries()].filter(([key]) => key !== 'engine').map(([, operation]) => operation.catch(() => {})));
        await assertOwnership?.();
        return await this.activateEngineUnlocked(buildId, family, assertOwnership);
      } finally { this.engineMaintenance = false; }
    });
  }
  private async activateEngineUnlocked(buildId: string, family: EngineFamily, assertOwnership?: () => Promise<void>) {
    const state = await this.engineVersions(), entry = state.staged.find((x: { buildId: string; family?: string }) => x.buildId === buildId && (x.family??'chromium')===family);
    if (!entry) throw new Error('Stage this engine build before activating it');
    const profiles = await this.listProfiles(true); if (profiles.some(x => x.state === 'running')) throw new Error('Stop all profiles before activating an engine update');
    // Always run a fresh isolated canary; a historic pass cannot admit a new activation.
    const qualification = await this.qualifyEngineUnlocked(buildId, family);
    const backup = join(this.directory,'engine-backups',randomUUID()); await mkdir(backup,{ recursive: true });
    await durableWrite(join(backup,'activation.json'),JSON.stringify({ state: 'preparing', previousExecutable: state.activeExecutable, buildId }));
    for (const profile of profiles) await this.export(profile.id,join(backup,`${profile.id}.workbench.tgz`));
    await durableWrite(join(backup,'activation.json'),JSON.stringify({ state: 'backed-up', previousExecutable: state.activeExecutable, buildId }));
    await assertOwnership?.();
    await durableWrite(join(this.directory,family==='brave'?'selected-brave.json':family==='vesper'?'selected-native-kernel.json':'selected-browser.json'),JSON.stringify({ ...entry, qualification }));
    await durableWrite(join(backup,'activation.json'),JSON.stringify({ state: 'activated', previousExecutable: state.activeExecutable, buildId })); return { buildId, backup, profilesBackedUp: profiles.length, qualification };
  }
  async environmentReport(id: string) {
    const browser = await puppeteer.connect({ browserWSEndpoint: await this.connectionUrl(id),defaultViewport:null });
    try { const page = (await browser.pages())[0]; if (!page) throw new Error('Open a tab before inspecting the environment');
      const observed = await page.evaluate(() => {
        const n = navigator, canvas = document.createElement('canvas'), gl = canvas.getContext('webgl'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
        return { userAgent: n.userAgent, platform: n.platform, languages: n.languages, hardwareConcurrency: n.hardwareConcurrency, deviceMemory: (n as Navigator & { deviceMemory?: number }).deviceMemory, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: Intl.DateTimeFormat().resolvedOptions().locale, screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth, pixelRatio: devicePixelRatio }, viewport: { width: innerWidth, height: innerHeight }, webGL: gl ? { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) } : null };
      });
      return { ...observed, fingerprint: await this.fingerprintReport(id) };
    } finally { await browser.disconnect(); }
  }
  async fingerprintReport(id: string) {
    const profile = await this.readProfile(id), live = this.live.get(id);
    return {
      engine: profile.settings.engine ?? 'chromium', kernelVersion: profile.browserVersion ?? 'unknown',
      requestedProtection: ['brave','vesper'].includes(profile.settings.engine??'chromium') ? profile.settings.fingerprint?.protection ?? 'standard' : 'off',
      implementation: profile.settings.engine==='vesper'?'native-chromium-patches':profile.settings.engine === 'brave' ? 'upstream-native-brave' : 'upstream-chromium',
      nativeKernel: profile.settings.engine==='vesper'?{ surfaces:['hardwareConcurrency','deviceMemory','RGBA8-canvas2d'], canvasSeed:'persisted-per-profile', cpuEnforcement:'process-launch' }:null,
      capabilities: fingerprintCapabilities, targetPolicy: live?.policy.snapshot() ?? null,
      policyOwnerConnected: Boolean(live?.browser.connected),
      limitations: ['Arbitrary device personas, WebGL, audio and font masking are not implemented.', 'Screen metrics are top-level CDP emulation; headed cross-process frames expose the native display. Headless uses a native virtual display.', 'Upstream Brave owns fingerprint seeds and per-site compatibility behavior.', 'Existing targets that executed during process boot are outside the pre-script guarantee.', 'Protection is the requested launch policy; sites and in-browser Shields changes can affect the actual result.'],
    };
  }
  async cookies(id: string, values?: unknown) {
    const validated=values===undefined?undefined:validateCookies(values);
    const browser = await puppeteer.connect({ browserWSEndpoint: await this.connectionUrl(id),defaultViewport:null });
    try { const context = browser.defaultBrowserContext(); if (validated) await context.setCookie(...validated); return cookieSnapshot(await context.cookies()); }
    finally { await browser.disconnect(); }
  }
  validateSettings(settings: Record<string, unknown>): LocalProfileSettings {
    const allowed = new Set(['name', 'storage', 'proxy', 'savedProxy', 'locale', 'timezone', 'viewport','folder','tags','notes','status','favorite','startPages','environment','engine','fingerprint','extensions']);
    const unsupported = Object.keys(settings).filter(key => !allowed.has(key));
    if (unsupported.length) throw new Error(`Unsupported local profile settings: ${unsupported.join(', ')}. This engine does not support proprietary fingerprint definitions.`);
    if (settings.storage !== undefined && settings.storage !== 'local') throw new Error('Local engine requires local storage');
    if (settings.name !== undefined && (typeof settings.name !== 'string' || settings.name.length > 200)) throw new Error('Invalid profile name');
    if (settings.locale !== undefined) { if (typeof settings.locale !== 'string') throw new Error('Invalid locale'); Intl.getCanonicalLocales(settings.locale); }
    if (settings.timezone !== undefined) { if (typeof settings.timezone !== 'string') throw new Error('Invalid timezone'); new Intl.DateTimeFormat('en', { timeZone: settings.timezone }); }
    if (settings.viewport !== undefined) {
      const v = settings.viewport as LocalProfileSettings['viewport'];
      if (!v || Object.keys(v).some(k => !['width', 'height', 'deviceScaleFactor'].includes(k)) || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width < 320 || v.height < 200 || v.width > 7680 || v.height > 4320 || (v.deviceScaleFactor !== undefined && (!Number.isFinite(v.deviceScaleFactor) || v.deviceScaleFactor < 0.5 || v.deviceScaleFactor > 4))) throw new Error('Invalid viewport');
    }
    if (settings.proxy !== undefined) {
      validateProxyChoice(settings.proxy);
    }
    if (settings.savedProxy !== undefined) {
      const ref = settings.savedProxy as LocalProfileSettings['savedProxy'];
      if (!ref || typeof ref !== 'object' || Array.isArray(ref) || Object.keys(ref).some(k => !['id','revision'].includes(k)) || typeof ref.id !== 'string' || !idPattern.test(ref.id) || !Number.isSafeInteger(ref.revision) || ref.revision < 1 || settings.proxy !== undefined) throw new Error('Invalid saved proxy reference; use either savedProxy or inline proxy');
    }
    for (const [key, limit] of [['folder',120],['notes',4000],['status',64]] as const) if (settings[key] !== undefined && (typeof settings[key] !== 'string' || settings[key].length > limit)) throw new Error(`Invalid ${key}`);
    if (settings.favorite !== undefined && typeof settings.favorite !== 'boolean') throw new Error('Invalid favorite');
    if (settings.tags !== undefined && (!Array.isArray(settings.tags) || settings.tags.length > 20 || settings.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 64))) throw new Error('Invalid tags');
    if (settings.startPages !== undefined && (!Array.isArray(settings.startPages) || settings.startPages.length > 20 || settings.startPages.some(page => { try { const url = new URL(page); return !['http:','https:'].includes(url.protocol) || !!url.username || !!url.password; } catch { return true; } }))) throw new Error('Invalid start pages');
    if (settings.environment !== undefined) validateEnvironment(settings.environment);
    const screen = (settings.environment as EnvironmentPolicy | undefined)?.screen, viewport = settings.viewport as LocalProfileSettings['viewport'];
    if (screen && viewport && (viewport.width > screen.width || viewport.height > screen.height || (viewport.deviceScaleFactor !== undefined && viewport.deviceScaleFactor !== screen.deviceScaleFactor))) throw new Error('Viewport must fit the screen and use the same device scale');
    if(settings.engine!==undefined&&(typeof settings.engine !== 'string'||!['chromium','brave','vesper'].includes(settings.engine)))throw new Error('Invalid browser engine');
    if(settings.extensions!==undefined)validateExtensionIds(settings.extensions);
    if (settings.fingerprint !== undefined) validateFingerprint(settings.fingerprint);
    if(settings.fingerprint&&settings.engine!=='vesper'&&['webgl','audio','fonts'].some(key=>key in (settings.fingerprint as object)))throw new Error('Additional native surface policies require Vesper');
    if (settings.fingerprint && (settings.fingerprint as FingerprintPolicy).protection === 'standard' && settings.engine !== 'brave' && settings.engine !== 'vesper') throw new Error('Native standard fingerprint protection requires Brave or Vesper');
    if((settings.environment as EnvironmentPolicy|undefined)?.deviceMemory!==undefined && settings.engine!=='vesper')throw new Error('Device memory policy requires the Vesper native kernel');
    return structuredClone(settings) as LocalProfileSettings;
  }
  async create(settings: Record<string, unknown>): Promise<{ id: string }> {
    return this.serial('extension-catalog', () => this.serial('profile-create', () => this.createUnlocked(settings)));
  }
  private async createUnlocked(settings: Record<string, unknown>): Promise<{ id: string }> {
    let validated: LocalProfileSettings;
    try { validated = this.validateSettings(settings); } catch (error) { throw Object.assign(error as Error, { status: 400 }); }
    await this.init();
    const { proxy: inlineProxy, savedProxy, ...publicSettings } = validated;
    const proxy = savedProxy ? this.proxyCatalog.connection(savedProxy.id,savedProxy.revision) : inlineProxy;
    const id = randomUUID(), directory = this.profileDir(id);
    await mkdir(join(directory, 'browser'), { recursive: true, mode: 0o700 });
    try {
      await this.extensionStore.prepare(join(directory,'browser'),validated.extensions??[]);
      if (proxy) await this.vault.put(id, proxy);
      const profile: LocalProfile = { id, name: validated.name ?? `Profile ${id.slice(0, 8)}`, createdAt: new Date().toISOString(), settings: publicSettings, hasProxy: Boolean(proxy), revision: 1 };
      await durableWrite(join(directory, 'manifest.json'), JSON.stringify(profile, null, 2)); return { id };
    } catch (error) { await rm(directory, { recursive: true, force: true }); await this.vault.delete(id); throw error; }
  }
  async listProfiles(includeTrashed = false): Promise<LocalProfile[]> {
    await this.init(); const profiles: LocalProfile[] = [];
    for (const id of await readdir(join(this.directory, 'profiles'))) {
      if (!idPattern.test(id)) continue;
      const profile = await this.readProfile(id), session = await this.session(id);
      if (includeTrashed || !profile.trashedAt) profiles.push({ ...profile, state: session && isAlive(session.pid) ? 'running' : 'stopped' });
    }
    return profiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async readProfile(id: string): Promise<LocalProfile> { await this.init(); return JSON.parse(await readFile(join(this.profileDir(id), 'manifest.json'), 'utf8')); }
  async update(id: string, settings: Record<string, unknown>): Promise<void> {
    if ('savedProxy' in settings) throw Object.assign(new Error('Assign a saved proxy using the profile proxy endpoint before changing settings'), { status:400 });
    return this.serial('extension-catalog', () => this.serial(id, () => this.updateUnlocked(id, settings)));
  }
  private async updateUnlocked(id: string, settings: Record<string, unknown>): Promise<void> {
    const { proxy: requestedProxy, ...rest } = settings;
      const profile = await this.readProfile(id), session = await this.session(id);
      if (session && isAlive(session.pid)) throw new Error('Stop the profile before changing settings');
      const validated = this.validateSettings({ ...profile.settings, ...rest, ...(requestedProxy == null ? {} : { proxy: requestedProxy }) });
      await this.extensionStore.prepare(join(this.profileDir(id),'browser'),validated.extensions??[]);
      if (requestedProxy === null) { await this.vault.delete(id); profile.hasProxy = false; }
      else if (validated.proxy) { await this.vault.put(id, validated.proxy); profile.hasProxy = true; }
      const { proxy, ...publicSettings } = validated;
      profile.settings = { ...profile.settings, ...publicSettings };
      if (validated.name !== undefined) profile.name = validated.name;
      profile.revision = (profile.revision ?? 1) + 1;
      await durableWrite(join(this.profileDir(id), 'manifest.json'), JSON.stringify(profile, null, 2));
  }
  private async session(id: string): Promise<Session | undefined> {
    try {
      const s = JSON.parse(await readFile(join(this.profileDir(id), 'session.json'), 'utf8')) as Session;
      const url = new URL(s.endpoint);
      if (!Number.isSafeInteger(s.pid) || s.pid < 1 || url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/devtools/browser/')) throw new Error('Invalid local browser session');
      if (s.nativeEndpoint !== undefined) {
        const native = new URL(s.nativeEndpoint);
        if (native.protocol !== 'ws:' || native.hostname !== '127.0.0.1' || !native.pathname.startsWith('/devtools/browser/')) throw new Error('Invalid native browser session');
      }
      return s;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return undefined; }
  }
  async install(id: string) { const profile=await this.readProfile(id); await this.executable(profile.settings.engine,profile.settings.fingerprint); }
  async trash(id: string, restore = false) { return this.serial(id, async () => {
    const profile = await this.readProfile(id), session = await this.session(id);
    if (session && isAlive(session.pid)) throw new Error('Stop the profile before moving it to trash');
    if (restore) delete profile.trashedAt; else profile.trashedAt = new Date().toISOString();
    profile.revision = (profile.revision ?? 1) + 1;
    await durableWrite(join(this.profileDir(id),'manifest.json'), JSON.stringify(profile));
  }); }
  async start(id: string) {
    const starting = this.starts.catch(() => {}).then(() => this.serial(id, async () => {
    const profile = await this.readProfile(id);
    if (profile.trashedAt) throw new Error('Restore the profile from trash before opening it');
    const prior = await this.session(id); if (prior && isAlive(prior.pid)) throw new Error('Profile is already running');
    if ((await this.listProfiles()).filter(p => p.state === 'running').length >= (this.options.maxConcurrency ?? 1)) throw new Error('Local browser capacity is full. Stop an open profile before starting another.');
    const executablePath = await this.executable(profile.settings.engine,profile.settings.fingerprint);
    let proxy: ProxyServer | undefined, browser: PuppeteerBrowser | undefined, gateway: Awaited<ReturnType<typeof createPolicyGateway>> | undefined, extensionCleanup = async () => {};
    try {
      const installedExtensions = await this.extensionStore.prepare(join(this.profileDir(id),'browser'),profile.settings.extensions??[]);
      const launchExtensions = await extensionLaunchPaths(installedExtensions.paths); extensionCleanup = launchExtensions.cleanup;
      if (launchExtensions.paths !== installedExtensions.paths) await this.extensionStore.validateLaunchCopies(launchExtensions.paths, installedExtensions.records);
      const args = ['--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update'];
      if(launchExtensions.paths.length)args.push('--load-extension='+launchExtensions.paths.join(','),'--disable-extensions-except='+launchExtensions.paths.join(','));
      if (profile.settings.locale) args.push(`--lang=${profile.settings.locale}`);
      if (profile.settings.viewport) args.push(`--window-size=${profile.settings.viewport.width},${profile.settings.viewport.height}`);
      if (profile.hasProxy) {
        const p = await this.vault.get<ProxyChoice>(id);
        const host = p.extra.host.includes(':') && !p.extra.host.startsWith('[') ? `[${p.extra.host}]` : p.extra.host;
        const upstream = new URL(`${p.value}://${host}:${p.extra.port}`);
        if (p.extra.id !== undefined) upstream.username = p.extra.id;
        if (p.extra.secret !== undefined) upstream.password = p.extra.secret;
        proxy = new ProxyServer({ host: '127.0.0.1', port: 0, prepareRequestFunction: () => ({ upstreamProxyUrl: upstream.href }) });
        await proxy.listen();
        args.push(`--proxy-server=http://127.0.0.1:${proxy.port}`, '--proxy-bypass-list=<-loopback>', '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
      }
      args.push(...environmentArguments(profile.settings.environment));
      if (this.options.headless && profile.settings.environment?.screen) {
        const screen = profile.settings.environment.screen;
        args.push(`--screen-info={${screen.width}x${screen.height} devicePixelRatio=${screen.deviceScaleFactor}}`);
      }
      if(profile.settings.engine==='vesper')args.push(...await nativeProfileArguments(join(this.profileDir(id),'browser'),profile.settings));
      await prepareNativePreferences(join(this.profileDir(id), 'browser'), profile.settings);
      const launchProfile = await profileLaunchPath(join(this.profileDir(id), 'browser'));
      const cleanupExtensions = extensionCleanup;
      extensionCleanup = async () => { await cleanupExtensions(); await launchProfile.cleanup(); };
      browser = await puppeteer.launch({ executablePath, userDataDir: launchProfile.path, headless: this.options.headless ?? false, defaultViewport: null, enableExtensions:installedExtensions.paths.length>0, args, timeout: 30_000 });
      const policySettings=structuredClone(profile.settings);
      // CPU is enforced before process startup by Vesper, rather than CDP.
      if(policySettings.engine==='vesper' && policySettings.environment)delete policySettings.environment.hardwareConcurrency;
      const policy = new TargetPolicy(browser, policySettings); await policy.install();
      // Disable only the launcher's automatic target attachment. It retains
      // process ownership and root lifecycle commands. Automation clients use
      // the guarded endpoint; policy uses its independent native connection.
      const launcherSession = await browser.target().createCDPSession();
      await launcherSession.connection()!.send('Target.setAutoAttach', { autoAttach: false, waitForDebuggerOnStart: false, flatten: true });
      await launcherSession.detach();
      gateway = await createPolicyGateway(browser.wsEndpoint(), (targetId, serviceBootstrap) => serviceBootstrap ? policy.readyForServiceBootstrap(targetId) : policy.ready(targetId));
      if (profile.settings.startPages?.length) {
        const startup = await puppeteer.connect({ browserWSEndpoint: gateway.endpoint, defaultViewport: null });
        try { for (const url of profile.settings.startPages) { const page = await startup.newPage(); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); } }
        finally { await startup.disconnect(); }
      }
      policy.assertHealthy();
      const pid = browser.process()?.pid; if (!pid) throw new Error('Browser process was not recorded');
      profile.browserVersion = await browser.version();
      await durableWrite(join(this.profileDir(id), 'manifest.json'), JSON.stringify(profile, null, 2));
      await durableWrite(join(this.profileDir(id), 'session.json'), JSON.stringify({ pid, endpoint: gateway.endpoint, nativeEndpoint: browser.wsEndpoint() }));
      this.live.set(id, { browser, proxy, policy, gateway, extensionCleanup });
      browser.once('disconnected', () => { void gateway?.close().catch(() => {}); void proxy?.close(true).catch(() => {}); });
      // The debug socket can close before Chromium flushes profile storage.
      // Keep both launch paths until the owned OS process has actually exited.
      browser.process()?.once('close', () => { void extensionCleanup().catch(() => {}); });
    } catch (error) { await browser?.close().catch(() => {}); await gateway?.close().catch(() => {}); await proxy?.close(true).catch(() => {}); const pid=browser?.process()?.pid; if(!pid||!isAlive(pid))await extensionCleanup().catch(() => {}); throw new Error(`Local Chromium could not start: ${(error as Error).message}`); }
    }));
    this.starts = starting; return starting;
  }
  async connectionUrl(id: string) {
    await this.init(); const session = await this.session(id);
    if (!session || !isAlive(session.pid)) throw new Error('Profile is not running');
    if (!this.live.get(id)?.browser.connected) throw new Error('Profile policy ownership was lost. Stop and reopen the profile before attaching automation.');
    return session.endpoint;
  }
  async stop(id: string) { return this.serial(id, () => this.stopUnlocked(id), true); }
  private async stopUnlocked(id: string) {
    await this.readProfile(id); const live = this.live.get(id), session = await this.session(id);
    if (live) {
      live.policy.stoppingBrowser();
      await live.browser.close();
    } else if (session && isAlive(session.pid)) {
      const browser = await puppeteer.connect({ browserWSEndpoint: session.nativeEndpoint ?? session.endpoint, defaultViewport: null, protocolTimeout: 5000 });
      try { await browser.close(); } finally { await browser.disconnect(); }
    }
    // Browser.close waits for an owned process. Recovery through CDP may finish earlier.
    if (session && isAlive(session.pid)) {
      for (let attempt = 0; attempt < 100 && isAlive(session.pid); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
      if (isAlive(session.pid)) throw new Error('Browser shutdown could not be confirmed');
    }
    await live?.extensionCleanup(); await live?.proxy?.close(true); this.live.delete(id);
    await rm(join(this.profileDir(id), 'session.json'), { force: true });
  }
  async export(id: string, file: string) { return this.serial(id, async () => {
    await this.readProfile(id); const session = await this.session(id);
    if (session && isAlive(session.pid)) throw new Error('Stop the profile before exporting');
    await mkdir(dirname(resolve(file)), { recursive: true, mode: 0o700 });
    const profile = await this.readProfile(id);
    // Rebind the proxy explicitly after import; never copy vault material into archives.
    await this.extensionStore.prepare(join(this.profileDir(id),'browser'),profile.settings.extensions??[]);
    const manifestFile = join(this.profileDir(id), 'archive.json');
    const destination = resolve(file);
    const handle = await open(destination, 'wx', 0o600); await handle.close();
    try {
      await durableWrite(manifestFile, JSON.stringify({ format: 'workbench-chromium', version: 1, platform: process.platform, profile: { ...profile, hasProxy: false } }));
      for (let attempt = 0; ; attempt++) {
        try {
          await tar.c({ file: destination, gzip: { level: 3 }, portable: true, cwd: this.profileDir(id), filter: (name, entry) => (name.replaceAll('\\','/').startsWith('browser/.vesper-extensions/') || !name.split(/[\\/]/).some(part => cacheNames.has(part))) && ('isFile' in entry ? entry.isFile() || entry.isDirectory() : ['File', 'Directory'].includes(entry.type)) }, ['archive.json', 'browser']);
          break;
        } catch (error) {
          // On Windows a exiting Chromium helper can briefly hold a cookie database
          // after the main PID is gone. Restart the whole archive, never publish partial bytes.
          if (process.platform !== 'win32' || !['EBUSY', 'EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '') || attempt >= 5) throw error;
          await new Promise(resolveDelay => setTimeout(resolveDelay, 50 * 2 ** attempt));
          await rm(destination, { force: true }); const retry = await open(destination, 'wx', 0o600); await retry.close();
        }
      }
    } catch (error) { await rm(destination, { force: true }); throw error; }
    finally { await rm(manifestFile, { force: true }); }
  }, true); }
  private async validateArchive(file: string, allowed: (name: string) => boolean) {
    let bytes = 0, count = 0;
    if ((await stat(file)).size > 2 * 1024 ** 3) throw new Error('Archive is too large');
    const seen = new Set<string>();
    const parser = new tar.Parser({ strict: true, maxDecompressionRatio: 1000, onReadEntry: entry => {
      const name = entry.path.replace(/\/$/, '');
      bytes += entry.size; count++;
      if (!['File', 'Directory'].includes(entry.type) || name.includes('\\') || name.includes(':') || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.' || !p || /[. ]$/.test(p) || /[<>"|?*\x00-\x1f]/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) || name.split('/').length > 64 || !allowed(name) || bytes > 2 * 1024 ** 3 || count > 100_000 || name.length > 1024 || seen.has(name.toLowerCase()) || (name === 'archive.json' && entry.size > 1024 * 1024)) {
        parser.abort(new Error('Invalid profile archive or import limits exceeded')); return;
      }
      seen.add(name.toLowerCase()); entry.resume();
    } });
    const stream = createReadStream(file);
    await new Promise<void>((resolveValidation, reject) => {
      const fail = (error: Error) => { stream.destroy(); reject(error); };
      parser.on('error', fail); stream.on('error', fail); parser.on('end', resolveValidation);
      stream.pipe(parser);
    });
  }
  async importProfile(file: string, overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    return this.serial('profile-import', () => this.importProfileUnlocked(file, overrides));
  }
  private async importProfileUnlocked(file: string, overrides: Record<string, unknown>): Promise<{ id: string }> {
    await this.init(); this.validateSettings(overrides);
    const staging = join(this.directory, `import-${randomUUID()}`); await mkdir(staging, { mode: 0o700 });
    let created: { id: string } | undefined;
    try {
      const snapshot = join(staging, 'source.tgz');
      if ((await stat(file)).size > 2 * 1024 ** 3) throw new Error('Archive is too large');
      await copyFile(file, snapshot);
      await this.validateArchive(snapshot, name => name === 'archive.json' || name === 'browser' || name.startsWith('browser/'));
      await tar.x({ file: snapshot, cwd: staging, strict: true, maxDepth: 64, preserveOwner: false });
      const manifest = JSON.parse(await readFile(join(staging, 'archive.json'), 'utf8')) as { format: string; version: number; platform: string; profile: LocalProfile };
      if (manifest.format !== 'workbench-chromium' || manifest.version !== 1 || manifest.platform !== process.platform || !manifest.profile?.settings || 'proxy' in manifest.profile.settings || manifest.profile.hasProxy !== false) throw new Error('Unsupported profile archive or operating system');
      if (!(await stat(join(staging, 'browser'))).isDirectory()) throw new Error('Archive is missing browser data');
      const combined={ ...manifest.profile.settings, name: `${manifest.profile.name} (imported)`, ...overrides };
      const {extensions: importedExtensions,...initialSettings}=combined;
      created = await this.create(initialSettings);
      await rm(join(this.profileDir(created.id), 'browser'), { recursive: true });
      await rename(join(staging, 'browser'), join(this.profileDir(created.id), 'browser'));
      if(importedExtensions!==undefined)await this.update(created.id,{extensions:importedExtensions});
      return created;
    } catch (error) { if (created) { await rm(this.profileDir(created.id), { recursive: true, force: true }); await this.vault.delete(created.id); } throw error; }
    finally { await rm(staging, { recursive: true, force: true }); }
  }
  async duplicate(id: string) {
    const file = join(this.directory, `duplicate-${randomUUID()}.tgz`);
    try { await this.export(id, file); return await this.importProfile(file); }
    finally { await rm(file, { force: true }); }
  }
  async findByRunId(runId: string) { return (await this.listProfiles()).find(p => p.name === `run-${runId}`); }
  async versions(id: string) { const profile = await this.readProfile(id); return { engineVersion: `vesper-browser/${vesperBrowserVersion}`, kernelVersion: profile.browserVersion ?? 'unknown' }; }
  async close() {
    if (this.closed) return;
    await this.starts.catch(() => {});
    await Promise.all([...this.operations.values()].map(p => p.catch(() => {})));
    for (const id of [...this.live.keys()]) await this.stop(id);
    if (this.initialized) {
      await this.initialized.catch(() => {});
      const file = join(this.directory, 'owner.json');
      const owner = await readFile(file, 'utf8').then(v => JSON.parse(v) as { ownerId: string }).catch(() => undefined);
      if (owner?.ownerId === this.ownerId) await rm(file);
    }
    this.closed = true;
    const release = this.unlock; this.unlock = undefined; await release?.();
  }
}
