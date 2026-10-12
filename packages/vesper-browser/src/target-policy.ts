import type { Browser } from 'puppeteer-core';
import { applyEnvironment, type EnvironmentPolicy } from './persona.js';
import { PolicyConnection, type PolicySession } from './cdp-connection.js';

interface Settings {
  locale?: string; timezone?: string; environment?: EnvironmentPolicy;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
}
export interface TargetPolicyReport {
  implementation: 'chromium-cdp'; beforeScript: boolean;
  scope: 'new-targets-after-controller-install';
  configured: Record<string, number>; failures: Array<{ type: string; message: string }>;
  alreadyRunning: Record<string, number>;
}
const attachedTypes = ['iframe', 'worker', 'shared_worker', 'service_worker'];
const workerTypes = new Set(['worker', 'shared_worker', 'service_worker']);

/** Pauses new targets at the Chromium boundary before their first script.
 * Independent automation clients may attach without owning this controller.
 * No navigator prototypes or site scripts are overwritten.
 */
export class TargetPolicy {
  private sessions = new Map<string, Promise<void>>();
  private sessionTargets = new Map<string, string>();
  private failed?: Error;
  private connection?: PolicyConnection;
  private stopping = false;
  private serviceBootstrap = new Set<string>();
  private report: TargetPolicyReport = { implementation: 'chromium-cdp', beforeScript: true, scope: 'new-targets-after-controller-install', configured: {}, alreadyRunning: {}, failures: [] };
  constructor(private browser: Browser, private settings: Settings, private connect: (endpoint: string) => Promise<PolicyConnection> = PolicyConnection.open) {}
  snapshot(): TargetPolicyReport { return structuredClone(this.report); }
  assertHealthy() { if (this.failed) throw this.failed; }
  async ready(targetId: string) {
    const deadline = Date.now() + 10000;
    while (!this.sessions.has(targetId)) {
      this.assertHealthy();
      if (Date.now() >= deadline) throw new Error('Target policy admission timed out');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    await this.sessions.get(targetId); this.assertHealthy();
  }
  async readyForServiceBootstrap(targetId: string) {
    const deadline = Date.now() + 10000;
    while (!this.serviceBootstrap.has(targetId)) {
      this.assertHealthy();
      if (Date.now() >= deadline) throw new Error('Service worker bootstrap admission timed out');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  private configure(session: PolicySession, type: string, targetId = session.id(), waitingForDebugger = true): Promise<void> {
    const existing = this.sessions.get(targetId);
    if (existing) return existing;
    const operation = this.configureNew(session, type, targetId, waitingForDebugger);
    this.sessions.set(targetId, operation);
    this.sessionTargets.set(session.id(), targetId);
    return operation;
  }
  private async configureNew(session: PolicySession, type: string, targetId: string, waitingForDebugger: boolean) {
    if(!waitingForDebugger)this.report.alreadyRunning[type]=(this.report.alreadyRunning[type]??0)+1;
    session.on('Target.detachedFromTarget', event => {
      const targetId = this.sessionTargets.get(event.sessionId);
      if (targetId) { this.sessionTargets.delete(event.sessionId); this.sessions.delete(targetId); this.serviceBootstrap.delete(targetId); }
    });
    // Listen before enabling auto-attach: Chromium can return targets immediately.
    session.on('Target.attachedToTarget', event => {
      const child = session.connection()?.session(event.sessionId);
      if (!child) { this.fail(event.targetInfo.type, new Error('Attached target session is missing')); return; }
      void (async () => {
        try {
          await this.configure(child, event.targetInfo.type, event.targetInfo.targetId, event.waitingForDebugger !== false);
          this.assertHealthy();
          await child.send('Runtime.runIfWaitingForDebugger');
        } catch (error) {
          // Closing the owned browser prevents a silently unconfigured target
          // from continuing. Do not resume on policy failure.
          if (this.browser.connected && !child.detached) this.fail(event.targetInfo.type, error);
        }
      })();
    });
    let serviceBreakpoint: string | undefined;
    // Chromium can restore extension workers before this controller exists.
    // Their first script has already run; do not wait for a breakpoint that
    // cannot occur, or describe these targets as configured before execution.
    if(type==='service_worker'&&!waitingForDebugger)this.serviceBootstrap.add(targetId);
    if (type === 'service_worker' && waitingForDebugger) {
      // A new service-worker target is reported before its main script is
      // fetched. Chromium holds that fetch until Runtime.runIfWaitingForDebugger,
      // so awaiting renderer Emulation commands at this stage deadlocks. Queue
      // a native before-script breakpoint first, release the fetch, then apply
      // policy while execution is still held at that breakpoint.
      let timer: ReturnType<typeof setTimeout>;
      const paused = new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Service worker did not reach its before-script breakpoint')), 10000);
        session.once('Debugger.paused', () => { clearTimeout(timer); resolve(); });
      });
      void paused.catch(() => {});
      try {
        const commands = [
          session.send('Debugger.enable'),
          session.send('Debugger.setInstrumentationBreakpoint', { instrumentation: 'beforeScriptExecution' }),
          session.send('Runtime.runIfWaitingForDebugger'),
        ];
        // Other debugger clients also hold the browser-level script fetch.
        // They may release that fetch once our before-script breakpoint is
        // queued; ordinary JS execution still waits for the policy controller.
        this.serviceBootstrap.add(targetId);
        const [, breakpoint] = await Promise.all(commands);
        serviceBreakpoint = breakpoint.breakpointId;
        await paused;
      } finally { clearTimeout(timer!); }
    }
    if (!['browser', 'tab'].includes(type)) {
      if (this.settings.locale) {
        try { await session.send('Emulation.setLocaleOverride', { locale: this.settings.locale }); }
        catch (error) {
          // A worker can inherit the parent's process-wide ICU override. Admit
          // this specific protocol conflict only after reading the actual value.
          if (!(error as Error).message.includes('Another locale override is already in effect')) throw error;
          const observed = await session.send('Runtime.evaluate', { expression: 'Intl.DateTimeFormat().resolvedOptions().locale', returnByValue: true });
          if (observed.result.value !== Intl.getCanonicalLocales(this.settings.locale)[0]) throw error;
        }
      }
      if (this.settings.timezone) await session.send('Emulation.setTimezoneOverride', { timezoneId: this.settings.timezone });
      await applyEnvironment(session, this.settings.environment, workerTypes.has(type) ? 'worker' : type === 'iframe' ? 'iframe' : 'page', this.settings.viewport);
      if (type === 'page' && this.settings.viewport && !this.settings.environment?.screen) {
        await session.send('Emulation.setDeviceMetricsOverride', { ...this.settings.viewport, deviceScaleFactor: this.settings.viewport.deviceScaleFactor ?? 1, mobile: false });
      }
      this.report.configured[type] = (this.report.configured[type] ?? 0) + 1;
    }
    await session.send('Target.setAutoAttach', {
      autoAttach: true, waitForDebuggerOnStart: true, flatten: true,
      filter: [{ type: 'page', exclude: false }, ...attachedTypes.map(type => ({ type, exclude: false })), { exclude: true }],
    });
    if (serviceBreakpoint) {
      this.assertHealthy();
      await session.send('Debugger.removeBreakpoint', { breakpointId: serviceBreakpoint });
      await session.send('Debugger.resume');
      await session.send('Debugger.disable');
    }
  }
  private fail(type: string, error: unknown) {
    if (this.failed) return;
    this.failed = new Error(`Environment policy failed for ${type}: ${(error as Error).message}`);
    this.report.beforeScript = false;
    this.report.failures.push({ type, message: this.failed.message });
    void this.browser.close().catch(() => {});
  }
  async install() {
    this.connection = await this.connect(this.browser.wsEndpoint());
    this.connection.on('closed', error => { if (!this.stopping && this.browser.connected) this.fail('connection', error); });
    this.browser.once('disconnected', () => { this.stopping = true; this.connection?.close(); });
    const root = this.connection.root;
    await this.configure(root, 'browser');
    // Existing initial blank pages need the same policy. Never navigate until
    // these sessions are ready. New pages/popups are covered by root auto-attach.
    for (const targetInfo of (await root.send('Target.getTargets')).targetInfos.filter((target: { type: string }) => target.type === 'page')) {
      const existing = this.sessions.get(targetInfo.targetId);
      if (existing) await existing;
      else {
        const { sessionId } = await root.send('Target.attachToTarget', { targetId: targetInfo.targetId, flatten: true });
        await this.configure(this.connection.session(sessionId)!, 'page', targetInfo.targetId);
      }
    }
    await Promise.all(this.sessions.values());
    this.assertHealthy();
  }
  stoppingBrowser() { this.stopping = true; }
}
