import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket, WebSocketServer } from 'ws';
import { once } from 'node:events';
import { createPolicyGateway } from '../src/cdp-gateway.js';

test('CDP gateway admits ordinary commands and holds target resume until policy completion', async () => {
  const native = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(native, 'listening');
  const address = native.address(); assert.ok(address && typeof address !== 'string');
  const observed: any[] = [];
  native.on('connection', socket => {
    socket.send(JSON.stringify({ method: 'Target.attachedToTarget', params: { sessionId: 'session', targetInfo: { targetId: 'target', type: 'shared_worker' } } }));
    socket.on('message', data => { const command = JSON.parse(data.toString()); observed.push(command); socket.send(JSON.stringify({ id: command.id, sessionId: command.sessionId, result: { completed: true } })); });
  });
  let admit!: () => void;
  const admission = new Promise<void>(resolve => { admit = resolve; });
  const gateway = await createPolicyGateway(`ws://127.0.0.1:${address.port}/devtools/browser/native`, async (target, bootstrap) => { assert.equal(target, 'target'); assert.equal(bootstrap, false); await admission; });
  let client: WebSocket | undefined;
  try {
    client = new WebSocket(gateway.endpoint);
    const attachment = once(client, 'message'); await once(client, 'open'); await attachment;
    const ordinary = once(client, 'message');
    client.send(JSON.stringify({ id: 1, method: 'Runtime.runIfWaitingForDebugger', sessionId: 'session' }));
    client.send(JSON.stringify({ id: 2, method: 'Runtime.enable', sessionId: 'session' }));
    assert.equal(JSON.parse((await ordinary)[0].toString()).id, 2);
    assert.deepEqual(observed.map(command => command.id), [2]);
    const resumed = once(client, 'message'); admit();
    assert.equal(JSON.parse((await resumed)[0].toString()).id, 1);
    assert.deepEqual(observed.map(command => command.id), [2, 1]);
  } finally { client?.terminate(); await gateway.close(); for (const socket of native.clients) socket.terminate(); await new Promise<void>(resolve => native.close(() => resolve())); }
});

test('CDP gateway rejects a failed policy and webpage-origin connections', async () => {
  const native = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(native, 'listening');
  const address = native.address(); assert.ok(address && typeof address !== 'string');
  const observed: any[] = [];
  native.on('connection', socket => {
    socket.send(JSON.stringify({ method: 'Target.attachedToTarget', params: { sessionId: 'session', targetInfo: { targetId: 'target', type: 'page' } } }));
    socket.on('message', data => observed.push(JSON.parse(data.toString())));
  });
  const gateway = await createPolicyGateway(`ws://127.0.0.1:${address.port}/devtools/browser/native`, async () => { throw new Error('Policy rejected'); });
  let client: WebSocket | undefined, webpage: WebSocket | undefined;
  try {
    client = new WebSocket(gateway.endpoint); const attachment = once(client, 'message'); await once(client, 'open'); await attachment;
    const rejection = once(client, 'message');
    client.send(JSON.stringify({ id: 1, method: 'Runtime.runIfWaitingForDebugger', sessionId: 'session' }));
    assert.match(JSON.parse((await rejection)[0].toString()).error.message, /Policy rejected/);
    assert.equal(observed.length, 0);
    webpage = new WebSocket(gateway.endpoint, { origin: 'https://owned.example' });
    await once(webpage, 'error');
    assert.notEqual(webpage.readyState, WebSocket.OPEN);
  } finally { client?.terminate(); webpage?.terminate(); await gateway.close(); for (const socket of native.clients) socket.terminate(); await new Promise<void>(resolve => native.close(() => resolve())); }
});
