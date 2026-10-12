import { EventEmitter } from 'node:events';

/** Minimal independent CDP transport. Puppeteer's target manager never sees
 * these sessions and therefore cannot resume or detach policy-owned workers.
 */
export class PolicySession extends EventEmitter {
  detached = false;
  constructor(private owner: PolicyConnection, private sessionId?: string) { super(); }
  id() { return this.sessionId ?? 'browser'; }
  connection() { return this.owner; }
  send(method: string, params?: Record<string, unknown>): Promise<any> {
    if (this.detached) return Promise.reject(new Error('Policy target detached'));
    return this.owner.send(method, params, this.sessionId);
  }
}
interface Pending {
  resolve: (value: any) => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>; sessionId?: string;
}
export class PolicyConnection extends EventEmitter {
  readonly root = new PolicySession(this);
  private sessions = new Map<string, PolicySession>();
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private socket: WebSocket;
  private stopped = false;
  private constructor(endpoint: string) {
    super(); this.socket = new WebSocket(endpoint);
    this.socket.addEventListener('message', event => this.message(String(event.data)));
    this.socket.addEventListener('close', () => this.finish(new Error('Policy CDP connection closed')));
    this.socket.addEventListener('error', () => this.finish(new Error('Policy CDP transport failed')));
  }
  static async open(endpoint: string) {
    const url = new URL(endpoint);
    if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/devtools/browser/')) throw new Error('Invalid policy CDP endpoint');
    const connection = new PolicyConnection(endpoint);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { connection.close(); reject(new Error('Policy CDP connection timed out')); }, 5000);
      connection.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      connection.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Policy CDP could not connect')); }, { once: true });
    });
    return connection;
  }
  session(id: string) { return this.sessions.get(id); }
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    if (this.stopped || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Policy CDP is disconnected'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Policy CDP command timed out: ${method}`)); }, 10000);
      this.pending.set(id, { resolve, reject, timer, sessionId });
      try { this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { this.pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  private message(text: string) {
    let value: any;
    try { value = JSON.parse(text); } catch { this.finish(new Error('Malformed policy CDP response')); this.socket.close(); return; }
    if (value.id !== undefined) {
      const pending = this.pending.get(value.id); if (!pending) return;
      this.pending.delete(value.id); clearTimeout(pending.timer);
      if (value.error) pending.reject(new Error(`Policy CDP error: ${value.error.message}`));
      else pending.resolve(value.result ?? {});
      return;
    }
    if (value.method === 'Target.attachedToTarget') this.sessions.set(value.params.sessionId, new PolicySession(this, value.params.sessionId));
    if (value.method === 'Target.detachedFromTarget') {
      const id = value.params.sessionId, session = this.sessions.get(id);
      if (session) { session.detached = true; session.removeAllListeners(); this.sessions.delete(id); }
      for (const [requestId, pending] of this.pending) if (pending.sessionId === id) {
        this.pending.delete(requestId); clearTimeout(pending.timer); pending.reject(new Error('Policy target detached'));
      }
    }
    const parent = value.sessionId ? this.sessions.get(value.sessionId) : this.root;
    parent?.emit(value.method, value.params);
  }
  private finish(error: Error) {
    if (this.stopped) return;
    this.stopped = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    for (const session of this.sessions.values()) { session.detached = true; session.removeAllListeners(); }
    this.sessions.clear(); this.root.detached = true; this.root.removeAllListeners();
    this.emit('closed', error);
  }
  close() { this.finish(new Error('Policy CDP connection closed')); this.socket.close(); }
}
