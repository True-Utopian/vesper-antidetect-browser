import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer, request} from 'node:http';
import {WebSocketServer} from 'ws';
import {createSeleniumDiscovery} from '../../../scripts/lib/selenium-discovery.mjs';

test('Selenium discovery refuses remote, credentialed and non-gateway endpoints before connecting', async () => {
  for (const endpoint of ['ws://example.com:123/devtools/browser/00000000-0000-0000-0000-000000000000', 'ws://u:p@127.0.0.1:123/devtools/browser/00000000-0000-0000-0000-000000000000', 'http://127.0.0.1:123/', 'ws://127.0.0.1:123/devtools/page/00000000-0000-0000-0000-000000000000']) {
    await assert.rejects(createSeleniumDiscovery(endpoint), /explicit local Browser policy gateway/);
  }
});

test('ChromeDriver discovery stays on the supplied guarded socket and exposes no control routes', async () => {
  const server = createServer(), sockets = new WebSocketServer({server});
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const commands: string[] = [], address = server.address() as {port: number};
  const endpoint = `ws://127.0.0.1:${address.port}/devtools/browser/00000000-0000-0000-0000-000000000000`;
  sockets.on('connection', socket => socket.on('message', bytes => {
    const message = JSON.parse(bytes.toString()); commands.push(message.method);
    const result = message.method === 'Browser.getVersion' ? {product: 'Chrome/157.0.8100.0', protocolVersion: '1.3', userAgent: 'Owned fixture AppleWebKit/537.36', jsVersion: 'test', revision: '@fixture'} : {targetInfos: [{targetId: 'owned', type: 'page', title: 'Owned fixture', url: 'about:blank', attached: false}]};
    socket.send(JSON.stringify({id: message.id, result}));
  }));
  const discovery = await createSeleniumDiscovery(endpoint), origin = 'http://' + discovery.address;
  try {
    const version = await (await fetch(origin + '/json/version')).json();
    assert.equal(version.webSocketDebuggerUrl, endpoint); assert.equal(version.Browser, 'Chrome/157.0.8100.0');
    assert.equal(version['WebKit-Version'], '537.36 (@fixture)');
    const targets = await (await fetch(origin + '/json/list')).json(); assert.equal(targets[0].id, 'owned');
    assert.equal((await fetch(origin + '/json/version', {headers: {origin: 'http://untrusted.example'}})).status, 403);
    const rebinding = await new Promise<number | undefined>((done, reject) => {
      const req = request(origin + '/json/version', {headers: {host: 'untrusted.example'}}, response => {response.resume(); response.once('end', () => done(response.statusCode));}); req.once('error', reject); req.end();
    });
    assert.equal(rebinding, 403);
    assert.equal((await fetch(origin + '/json/version', {method: 'POST'})).status, 405);
    assert.equal((await fetch(origin + '/json/close/owned')).status, 404);
    assert.deepEqual(commands, ['Browser.getVersion', 'Target.getTargets']);
  } finally {
    await discovery.close(); await discovery.close();
    for (const socket of sockets.clients) socket.terminate();
    await new Promise<void>(done => sockets.close(() => done())); await new Promise<void>(done => server.close(() => done()));
  }
  await assert.rejects(fetch(origin + '/json/version'));
});

test('Loss of the guarded browser connection fails discovery and drains pending commands', async () => {
  const server = createServer(), sockets = new WebSocketServer({server});
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  sockets.on('connection', socket => socket.on('message', () => socket.close()));
  const address = server.address() as {port: number};
  const discovery = await createSeleniumDiscovery(`ws://127.0.0.1:${address.port}/devtools/browser/00000000-0000-0000-0000-000000000000`);
  try {assert.equal((await fetch('http://' + discovery.address + '/json/version')).status, 503);}
  finally {await discovery.close(); await new Promise<void>(done => sockets.close(() => done())); await new Promise<void>(done => server.close(() => done()));}
});
