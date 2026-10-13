// Runs with the packaged Electron executable in Node mode. Renderers never import this module.
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [product, payload, directory] = process.argv.slice(2);
if (!['browser', 'workbench'].includes(product) || !payload || !directory) throw new Error('Invalid desktop service invocation');
await mkdir(directory, { recursive: true, mode: 0o700 });
if (product === 'workbench') {
  if (process.env.VESPER_LOCAL_COORDINATOR === 'true') {
    const { default: Fastify } = await import(pathToFileURL(join(payload, 'node_modules/fastify/fastify.js')).href);
    const { default: cookie } = await import(pathToFileURL(join(payload, 'node_modules/@fastify/cookie/index.js')).href);
    const { registerFixture } = await import(pathToFileURL(join(payload, 'dist/fixture.js')).href);
    const { loadConfig } = await import(pathToFileURL(join(payload, 'dist/config.js')).href);
    const config = await loadConfig();
    const fixture = Fastify(); await fixture.register(cookie); await registerFixture(fixture, config.token);
    fixture.get('/demo', async (_request, reply) => reply.type('text/html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Vesper local form</title><main><h1>Vesper test form</h1><p>By true-utopian. This page stays on your PC.</p><form><label>Message <input data-test="message" required></label><button data-test="save">Save</button></form><p data-test="saved"></p></main><script>document.querySelector("form").onsubmit=e=>{e.preventDefault();document.querySelector("[data-test=saved]").textContent=document.querySelector("input").value;localStorage.setItem("vesper-demo","saved");}</script></html>'));
    const origin = await fixture.listen({ host: '127.0.0.1', port: 0 });
    process.env.FIXTURE_ORIGIN = origin; process.env.ENABLE_TEST_FIXTURE = 'true'; process.env.DEMO_URL = origin + '/demo';
    process.on('disconnect', () => void fixture.close());
  }
  process.argv = [process.execPath, join(payload, 'dist/cli.js'), 'serve'];
  await import(pathToFileURL(join(payload, 'dist/cli.js')).href);
} else {
  const { VesperBrowser, browserAccessToken, createBrowserServer } = await import(pathToFileURL(join(payload, 'packages/vesper-browser/dist/index.js')).href);
  const browser = new VesperBrowser({ directory, executablePath: process.env.VESPER_BROWSER_EXECUTABLE, maxConcurrency: Number(process.env.VESPER_BROWSER_MAX_CONCURRENCY ?? 4), headless: process.env.VESPER_BROWSER_HEADLESS === 'true', graphicsBackend: process.env.VESPER_GRAPHICS_BACKEND || 'default' });
  if (process.env.VESPER_BUNDLED_KERNEL_MANIFEST) {
    const { stageBundledKernel } = await import('./bundled-kernel.mjs');
    await stageBundledKernel(browser, payload, process.env.VESPER_BUNDLED_KERNEL_MANIFEST);
  }
  const token = await browserAccessToken(directory);
  const server = await createBrowserServer(browser, token, { shutdown: () => close() });
  let closing = false;
  const instance = randomUUID(), descriptor = join(directory, 'service.json');
  const close = async () => {
    if (closing) return; closing = true;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await browser.close();
    const current = JSON.parse(await readFile(descriptor, 'utf8').catch(() => '{}'));
    if (current.instance === instance) await rm(descriptor, { force: true });
    if(process.connected)process.disconnect?.();
  };
  // Desktop-only shutdown is authenticated by the same private loopback bearer.
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await writeFile(descriptor, JSON.stringify({ version: 1, product: 'Vesper Browser', apiVersion: '1.0', port, pid: process.pid, instance }), { mode: 0o600 });
  process.send?.({ type: 'ready', port, product: 'Vesper Browser' });
  process.on('message', message => { if (message === 'shutdown') void close(); });
  process.once('SIGTERM', () => void close()); process.once('SIGINT', () => void close());
}
