import {createServer} from 'node:http';
import {WebSocket} from 'ws';

/** Provide ChromeDriver's HTTP discovery over one already-authorized policy gateway.
 * No native endpoint, Browser token, profile launch, or policy bypass is involved.
 * Keep this adapter alive only while its owning WebDriver attachment is needed.
 */
export async function createSeleniumDiscovery(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash || !/^\/devtools\/browser\/[a-f0-9-]{36}$/.test(url.pathname)) throw Error('Require an explicit local Browser policy gateway');
  const upstream = new WebSocket(url, {maxPayload: 8 * 1024 ** 2});
  const pending = new Map(); let id = 0, closed = false, address;
  const rejectPending = () => {for (const p of pending.values()) {clearTimeout(p.timer); p.reject(Error('Selenium discovery connection closed'));} pending.clear();};
  upstream.on('error', rejectPending); upstream.on('close', rejectPending);
  upstream.on('message', (bytes, binary) => {
    if (binary) {upstream.terminate(); return;}
    let message; try {message = JSON.parse(bytes.toString());} catch {upstream.terminate(); return;}
    const p = pending.get(message.id); if (!p) return;
    pending.delete(message.id); clearTimeout(p.timer);
    if (message.error) p.reject(Error('Guarded discovery command failed')); else p.resolve(message.result);
  });
  await new Promise((done, reject) => {upstream.once('open', done); upstream.once('error', reject);});
  const command = method => new Promise((resolve, reject) => {
    if (closed || upstream.readyState !== WebSocket.OPEN || pending.size >= 16) {reject(Error('Discovery unavailable')); return;}
    const request = ++id, timer = setTimeout(() => {pending.delete(request); reject(Error('Discovery timed out'));}, 10000);
    pending.set(request, {resolve, reject, timer}); upstream.send(JSON.stringify({id: request, method}));
  });
  const server = createServer(async (request, response) => {
    const send = (status, value) => {response.writeHead(status, {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}); response.end(JSON.stringify(value));};
    if (request.headers.origin || request.headers.host !== address) {send(403, {error: 'Local discovery only'}); return;}
    if (request.method !== 'GET') {send(405, {error: 'GET only'}); return;}
    try {
      if (request.url === '/json/version') {
        const version = await command('Browser.getVersion');
        const webkit = /\bAppleWebKit\/([0-9]+\.[0-9]+)/.exec(version.userAgent);
        if (!webkit || typeof version.revision !== 'string') throw Error('Invalid browser version metadata');
        send(200, {'Browser': version.product, 'Protocol-Version': version.protocolVersion, 'User-Agent': version.userAgent, 'V8-Version': version.jsVersion, 'WebKit-Version': `${webkit[1]} (${version.revision})`, webSocketDebuggerUrl: endpoint});
      } else if (request.url === '/json/list' || request.url === '/json') {
        const {targetInfos} = await command('Target.getTargets');
        send(200, targetInfos.map(t => ({id: t.targetId, type: t.type, title: t.title, url: t.url, attached: t.attached})));
      } else send(404, {error: 'Unknown discovery route'});
    } catch {send(503, {error: 'Guarded browser connection unavailable'});}
  });
  server.on('upgrade', (_request, socket) => socket.destroy());
  try {await new Promise((done, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', done);});}
  catch (error) {upstream.terminate(); throw error;}
  address = '127.0.0.1:' + server.address().port;
  return {address, async close() {if (closed) return; closed = true; rejectPending(); upstream.terminate(); server.closeAllConnections(); await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));}};
}
