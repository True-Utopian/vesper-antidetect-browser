import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

/** Private loopback CDP endpoint that prevents automation clients from resuming
 * a target before its independently owned profile policy has finished.
 */
export async function createPolicyGateway(nativeEndpoint: string, ready: (targetId: string, serviceBootstrap: boolean) => Promise<void>) {
  const server = createServer((_request, response) => { response.writeHead(404); response.end(); });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 ** 2 });
  const upstreams = new Set<WebSocket>();
  const path = `/devtools/browser/${randomUUID()}`;
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== path || request.headers.origin) { socket.destroy(); return; }
    sockets.handleUpgrade(request, socket, head, client => {
      const upstream = new WebSocket(nativeEndpoint, { maxPayload: 64 * 1024 ** 2 });
      upstreams.add(upstream);
      const targets = new Map<string, { id: string; type: string }>();
      const early: string[] = []; let earlyBytes = 0, waiting = 0;
      const connected = new Promise<void>((resolve, reject) => {
        upstream.once('open', resolve); upstream.once('error', reject); upstream.once('close', () => reject(new Error('Native CDP closed')));
      });
      // Handle its rejection even when the client sends no command.
      void connected.catch(() => client.terminate());
      upstream.on('message', (data, binary) => {
        if (binary) { client.terminate(); return; }
        const text = data.toString();
        let message: any;
        try { message = JSON.parse(text); } catch { client.terminate(); return; }
        if (message.method === 'Target.attachedToTarget') targets.set(message.params.sessionId, { id: message.params.targetInfo.targetId, type: message.params.targetInfo.type });
        if (message.method === 'Target.detachedFromTarget') targets.delete(message.params.sessionId);
        if (client.readyState === WebSocket.OPEN) client.send(text);
      });
      client.on('message', (data, binary) => {
        if (binary) { client.terminate(); return; }
        const text = data.toString();
        let message: any;
        try { message = JSON.parse(text); } catch { client.terminate(); return; }
        if (typeof message.method !== 'string' || !Number.isSafeInteger(message.id)) { client.terminate(); return; }
        const target = targets.get(message.sessionId);
        const guarded = ['Runtime.runIfWaitingForDebugger', 'Debugger.resume'].includes(message.method) && target && ['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(target.type);
        if (guarded) {
          if (++waiting > 1024) { client.terminate(); return; }
          void (async () => {
            try {
              await connected; await ready(target.id, target.type === 'service_worker' && message.method === 'Runtime.runIfWaitingForDebugger');
              if (upstream.readyState === WebSocket.OPEN && client.readyState === WebSocket.OPEN) upstream.send(text);
            } catch (error) {
              if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ id: message.id, ...(message.sessionId ? { sessionId: message.sessionId } : {}), error: { code: -32000, message: (error as Error).message } }));
            } finally { waiting--; }
          })();
        } else if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
        else if (upstream.readyState === WebSocket.CONNECTING) {
          earlyBytes += Buffer.byteLength(text);
          if (earlyBytes > 16 * 1024 ** 2) { client.terminate(); return; }
          early.push(text);
        }
      });
      upstream.once('open', () => { for (const text of early) upstream.send(text); early.length = 0; earlyBytes = 0; });
      upstream.on('error', () => client.terminate());
      upstream.on('close', () => { upstreams.delete(upstream); client.terminate(); });
      client.on('error', () => upstream.terminate());
      client.on('close', () => upstream.terminate());
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('CDP gateway did not bind');
  return {
    endpoint: `ws://127.0.0.1:${address.port}${path}`,
    async close() {
      for (const client of sockets.clients) client.terminate();
      for (const upstream of upstreams) upstream.terminate();
      await new Promise<void>(resolve => sockets.close(() => resolve()));
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
