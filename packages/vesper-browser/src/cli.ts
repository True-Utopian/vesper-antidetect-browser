#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VesperBrowser } from './browser.js';
import { browserAccessToken, createBrowserServer } from './server.js';

const [command, ...args] = process.argv.slice(2);
const help = `Vesper Browser by true-utopian

  install                       Install free Chromium
  serve                         Open the local profile manager on port 3181
  token                         Print this store's profile manager access token
  list                          List profiles
  create <settings.json>        Create a profile
  edit <id> <settings.json>     Change a stopped profile
  open <id>                     Open until Ctrl+C, then stop cleanly
  stop <id>                     Recover and stop an orphaned browser
  export <id> <file>             Export a stopped profile
  import <file>                 Import a profile archive
  duplicate <id>                Copy a stopped profile

VESPER_BROWSER_DIR selects the private store (default .vesper/browser).
VESPER_BROWSER_EXECUTABLE selects an existing Chromium executable.
VESPER_BROWSER_HEADLESS=true enables headless browsing.
VESPER_BROWSER_PORT changes the local profile manager port.
VESPER_BROWSER_MAX_CONCURRENCY sets the number of open browser profiles (default 1).
CLI operations require exclusive access to the selected profile store.
`;
if (!command || ['help', '--help', '-h'].includes(command)) {
  console.log(help);
} else {
  const browser = new VesperBrowser({
    directory: resolve(process.env.VESPER_BROWSER_DIR ?? '.vesper/browser'),
    executablePath: process.env.VESPER_BROWSER_EXECUTABLE,
    headless: process.env.VESPER_BROWSER_HEADLESS === 'true',
    buildId: process.env.VESPER_BROWSER_BUILD_ID,
    maxConcurrency: Number(process.env.VESPER_BROWSER_MAX_CONCURRENCY ?? 1),
  });
  const required = (index: number) => { const value = args[index]; if (!value) throw new Error(`Missing argument.\n${help}`); return value; };
  const settings = async (index: number) => {
    const value: unknown = JSON.parse(await readFile(required(index), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings must be a JSON object');
    return value as Record<string, unknown>;
  };
  try {
    switch (command) {
      case 'install': console.log(await browser.installBrowser()); break;
      case 'token': console.log(await browserAccessToken(resolve(process.env.VESPER_BROWSER_DIR ?? '.vesper/browser'))); break;
      case 'serve': {
        const directory = resolve(process.env.VESPER_BROWSER_DIR ?? '.vesper/browser');
        const port = Number(process.env.VESPER_BROWSER_PORT ?? 3181);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('VESPER_BROWSER_PORT must be between 1 and 65535');
        const server = await createBrowserServer(browser, await browserAccessToken(directory));
        await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
        console.log(`Vesper Browser by true-utopian\nProfile manager: http://127.0.0.1:${port}/\nAccess token: vesper-browser token\nPrivate store: ${directory}`);
        await new Promise<void>(done => {
          const finish = () => { process.off('SIGINT', finish); process.off('SIGTERM', finish); server.close(() => done()); };
          process.once('SIGINT', finish); process.once('SIGTERM', finish);
        });
        break;
      }
      case 'list': console.log(JSON.stringify(await browser.listProfiles(), null, 2)); break;
      case 'create': console.log(JSON.stringify(await browser.create(await settings(0)))); break;
      case 'edit': await browser.update(required(0), await settings(1)); break;
      case 'stop': await browser.stop(required(0)); break;
      case 'export': await browser.export(required(0), required(1)); break;
      case 'import': console.log(JSON.stringify(await browser.importProfile(required(0)))); break;
      case 'duplicate': console.log(JSON.stringify(await browser.duplicate(required(0)))); break;
      case 'open': {
        const id = required(0);
        await browser.start(id);
        console.log(`Opened ${id}. Press Ctrl+C to stop and preserve storage.`);
        await new Promise<void>(done => {
          const finish = () => { clearInterval(timer); process.off('SIGINT', finish); process.off('SIGTERM', finish); done(); };
          const timer = setInterval(() => {
            void browser.listProfiles().then(profiles => { if (profiles.find(profile => profile.id === id)?.state !== 'running') finish(); }).catch(finish);
          }, 500);
          process.once('SIGINT', finish); process.once('SIGTERM', finish);
        });
        break;
      }
      default: throw new Error(`Unknown command: ${command}\n${help}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Vesper Browser operation failed'); process.exitCode = 1;
  } finally { await browser.close(); }
}
