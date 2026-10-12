import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TargetPolicy } from '../src/target-policy.js';
import type { PolicyConnection } from '../src/cdp-connection.js';
import type { Browser, CDPSession } from 'puppeteer-core';

class Session extends EventEmitter {
  calls: string[] = [];
  detached = false;
  constructor(readonly name: string, readonly children = new Map<string, Session>(), public sendValue?: (method: string) => unknown) { super(); }
  id() { return this.name; }
  connection() { return { session: (id: string) => this.children.get(id) }; }
  async send(method: string) { this.calls.push(method); return this.sendValue?.(method) ?? {}; }
}

async function fixture(locale: string) {
  const root = new Session('root');
  let closed = 0;
  const browser = Object.assign(new EventEmitter(), { connected: true, wsEndpoint: () => 'ws://fixture', close: async () => { closed++; } }) as unknown as Browser;
  const connection = Object.assign(new EventEmitter(), { root, close() {} }) as unknown as PolicyConnection;
  root.sendValue = method => method === 'Target.getTargets' ? { targetInfos: [] } : {};
  const policy = new TargetPolicy(browser, { locale }, async () => connection); await policy.install();
  return { root, policy, closed: () => closed };
}
async function settle(predicate: () => boolean) {
  for (let i = 0; i < 30 && !predicate(); i++) await new Promise(done => setImmediate(done));
  assert.ok(predicate(), 'Policy operation did not settle');
}

test('inherited worker locale conflict resumes only after verifying the real locale', async () => {
  for (const observed of ['fr-FR', 'en-US']) {
    const { root, policy, closed } = await fixture('fr-FR');
    const child = new Session('child', undefined, method => {
      if (method === 'Emulation.setLocaleOverride') throw new Error('Protocol error (Emulation.setLocaleOverride): Another locale override is already in effect');
      if (method === 'Runtime.evaluate') return { result: { value: observed } };
    });
    root.children.set('child', child);
    root.emit('Target.attachedToTarget', { sessionId: 'child', targetInfo: { type: 'worker', targetId: 'worker' } });
    await settle(() => observed === 'fr-FR' ? child.calls.includes('Runtime.runIfWaitingForDebugger') : closed() > 0);
    assert.equal(child.calls.includes('Runtime.runIfWaitingForDebugger'), observed === 'fr-FR');
    assert.equal(policy.snapshot().beforeScript, observed === 'fr-FR');
    assert.equal(closed(), observed === 'fr-FR' ? 0 : 1);
  }
});

test('a rejected worker policy closes the browser and does not execute the target', async () => {
  const { root, policy, closed } = await fixture('fr-FR');
  const child = new Session('child', undefined, method => { if (method === 'Emulation.setLocaleOverride') throw new Error('Unsupported policy'); });
  root.children.set('child', child);
  root.emit('Target.attachedToTarget', { sessionId: 'child', targetInfo: { type: 'worker', targetId: 'worker' } });
  await settle(() => closed() > 0);
  assert.equal(closed(), 1);
  assert.equal(child.calls.includes('Runtime.runIfWaitingForDebugger'), false);
  assert.throws(() => policy.assertHealthy(), /Unsupported policy/);
  assert.equal(policy.snapshot().failures.length, 1);
});

test('restored service workers are configured without waiting for an already executed first script', async () => {
  const {root,policy,closed}=await fixture('fr-FR');const child=new Session('restored');root.children.set('restored',child);
  root.emit('Target.attachedToTarget',{sessionId:'restored',waitingForDebugger:false,targetInfo:{type:'service_worker',targetId:'restored-worker'}});
  await settle(()=>child.calls.includes('Runtime.runIfWaitingForDebugger'));
  await policy.readyForServiceBootstrap('restored-worker');
  assert.equal(child.calls.includes('Debugger.setInstrumentationBreakpoint'),false);
  assert.equal(policy.snapshot().alreadyRunning.service_worker,1);assert.equal(closed(),0);
});

test('new service workers still wait at a native before-script breakpoint before policy and resume', async () => {
  const {root,policy,closed}=await fixture('fr-FR');const child=new Session('fresh',undefined,method=>{
    if(method==='Debugger.setInstrumentationBreakpoint')return {breakpointId:'owned-breakpoint'};
    if(method==='Runtime.runIfWaitingForDebugger')setImmediate(()=>child.emit('Debugger.paused',{}));
  });root.children.set('fresh',child);
  root.emit('Target.attachedToTarget',{sessionId:'fresh',waitingForDebugger:true,targetInfo:{type:'service_worker',targetId:'fresh-worker'}});
  await settle(()=>child.calls.includes('Debugger.resume'));await policy.ready('fresh-worker');
  assert.ok(child.calls.indexOf('Debugger.setInstrumentationBreakpoint')<child.calls.indexOf('Emulation.setLocaleOverride'));
  assert.ok(child.calls.indexOf('Emulation.setLocaleOverride')<child.calls.indexOf('Debugger.resume'));
  assert.deepEqual(policy.snapshot().alreadyRunning,{});assert.equal(closed(),0);
});
