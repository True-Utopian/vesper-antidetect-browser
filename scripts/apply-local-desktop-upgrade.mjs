import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import update from '../desktop/update-contract.cjs';
import plugin from '../desktop/plugin-contract.cjs';
import { hashPrivateInventory, validateResumeBackup } from './upgrade-inventory.mjs';

// Default is a read-only preflight. --apply performs the reviewed real upgrade;
// it never force-closes processes, alters test installation registry locations,
// uninstalls applications, deletes user data or automatically rolls data back.
const args = process.argv.slice(2), options = {};
for (let index = 0; index < args.length; index++) {
  const name = args[index];
  if (name === '--apply' || name === '--no-launch' || name === '--addon-only') options[name.slice(2)] = true;
  else if (['--data-root', '--browser-install-root', '--workbench-install-root', '--release-root', '--addon-manifest', '--release-record', '--resume-backup'].includes(name) && args[index + 1] && !args[index + 1].startsWith('--')) options[name.slice(2)] = args[++index];
  else throw new Error(`Unknown or incomplete upgrade argument: ${name}`);
}
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This local upgrade helper requires Windows x64');
const release = resolve(options['release-root'] ?? join(import.meta.dirname, '../release'));
const logicalData = resolve(options['data-root'] ?? join(homedir(), 'AppData/Roaming/true-utopian/vesper'));
const data = await realpath(logicalData);
const browserRoot = await realpath(resolve(options['browser-install-root'] ?? join(homedir(), 'AppData/Local/Programs/Vesper Browser')));
const workbenchRoot = options['workbench-install-root'] ? await realpath(resolve(options['workbench-install-root'])) : undefined;
const exec = promisify(execFile);
const busy = new Set(['queued', 'preparing', 'starting', 'running', 'paused', 'awaiting_input', 'recovering', 'saving']);
const report = { mode: options.apply ? 'apply' : 'dry-run', actualInstallationChanged: false, dataRoot: data, browserInstallRoot: browserRoot, workbenchInstallRoot: workbenchRoot ?? null, artifacts: {}, checks: [], steps: [] };
if (options['addon-only']) assert.ok(options['addon-manifest'] && !workbenchRoot, 'Add-on-only upgrades require an explicit signed manifest and do not install standalone apps');
else assert.ok(!options['addon-manifest'], 'An explicit add-on manifest requires --addon-only');
const progress = message => process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
assert.ok(!options['resume-backup'] || options.apply, 'Resume a backup only during an explicit apply operation');

async function optionalJson(file) { try { const metadata = await lstat(file); assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size < 1024 * 1024, 'Unsafe or oversized state metadata'); return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }
function alive(pid) { assert.ok(Number.isSafeInteger(pid) && pid > 0, 'Invalid persisted process ID'); try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }
function inside(root, path) { const child = relative(root, path); assert.ok(child && !child.startsWith('..') && !isAbsolute(child), 'Path escaped its owned root'); }
async function asarText(installation, path) {
  const handle = await open(join(installation, 'resources/app.asar'), 'r');
  try {
    const prefix = Buffer.alloc(8); assert.equal((await handle.read(prefix, 0, 8, 0)).bytesRead, 8);
    const size = prefix.readUInt32LE(4); assert.ok(size > 8 && size < 8 * 1024 * 1024, 'Unexpected application archive header');
    const header = Buffer.alloc(size); assert.equal((await handle.read(header, 0, size, 8)).bytesRead, size);
    const textSize = header.readUInt32LE(4); assert.ok(textSize <= size - 8);
    let entry = JSON.parse(header.subarray(8, 8 + textSize).toString());
    for (const component of path.split('/')) entry = entry.files?.[component];
    assert.ok(entry && !entry.unpacked && !entry.link && Number.isSafeInteger(entry.size) && entry.size <= 65536 && /^\d+$/.test(entry.offset), 'Required installed metadata is missing');
    const bytes = Buffer.alloc(entry.size); assert.equal((await handle.read(bytes, 0, bytes.length, 8 + size + Number(entry.offset))).bytesRead, bytes.length);
    return bytes.toString();
  } finally { await handle.close(); }
}
async function files(root, relativeRoot = '') {
  const values = [];
  for (const item of await readdir(join(root, relativeRoot), { withFileTypes: true })) {
    const path = join(relativeRoot, item.name), full = join(root, path), metadata = await lstat(full);
    assert.ok(!metadata.isSymbolicLink(), 'The private data store contains a link; review it before upgrading');
    if (metadata.isDirectory()) values.push(...await files(root, path));
    else { assert.ok(metadata.isFile(), 'Unexpected private data entry'); values.push({ path, bytes: metadata.size }); }
  }
  return values.sort((a, b) => a.path.localeCompare(b.path));
}
async function inventory(root) { return hashPrivateInventory(root, await files(root)); }
async function processesStopped() {
  const command = "@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^vesper-(browser|workbench)\\.exe$'} | Select-Object ProcessId,Name) | ConvertTo-Json -Compress";
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, maxBuffer: 1024 * 1024 });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [], list = Array.isArray(parsed) ? parsed : [parsed];
  assert.equal(list.length, 0, 'Close Vesper desktop apps normally before applying this upgrade');
}
async function guards() {
  await processesStopped();
  for (const name of ['browser/service.json', 'browser/owner.json', 'workbench/service.json', 'workbench/coordinator/database.owner.json']) {
    const state = await optionalJson(join(data, name)); if (state?.pid !== undefined) assert.equal(alive(state.pid), false, 'A Vesper service or database owner is still alive');
  }
  const journal = await optionalJson(join(data, 'browser/api-state.json'));
  assert.equal(Object.keys(journal?.leases ?? {}).length, 0, 'A browser profile still belongs to an automation run; finish or recover it first');
  const schedules = await optionalJson(join(data, 'workbench/scheduler/schedules.json')) ?? [];
  assert.ok(Array.isArray(schedules), 'Invalid persisted schedules');
  assert.ok(schedules.every(schedule => !schedule.enabled && !['running', 'admitting'].includes(schedule.state)), 'Pause enabled schedules and finish active occurrences before upgrading');
  let profileSessions = 0, runRecords = 0;
  for (const file of await files(data)) {
    if (/^browser[\\/]profiles[\\/][a-f0-9-]{36}[\\/]session\.json$/.test(file.path)) { const session = await optionalJson(join(data, file.path)); assert.equal(alive(session.pid), false, 'An owned native profile browser is still alive'); profileSessions++; }
    if (/^workbench[\\/](?:script-state[\\/])?run-[a-f0-9-]{36}\.json$/.test(file.path)) { const run = await optionalJson(join(data, file.path)); assert.ok(!busy.has(run.state) && !run.cleanupRequired, 'A persisted automation run needs completion or recovery'); runRecords++; }
  }
  return { nativeSessionRecords: profileSessions, scriptRunRecords: runRecords, profileLeases: 0, enabledSchedules: 0, runningDesktopProcesses: 0, runningServiceOwners: 0 };
}
async function inspectDatabaseCopy(backup, installed) {
  const database = join(backup, 'data/workbench/coordinator/database');
  try { await lstat(database); } catch (error) { if (error.code === 'ENOENT') return { activeFlows: 0, databasePresent: false }; throw error; }
  assert.ok(installed, 'An existing signed Workbench payload is needed to inspect its offline coordinator database');
  const scratch = await realpath(await mkdtemp(join(await realpath(tmpdir()), 'vesper-upgrade-database-')));
  let db;
  try {
    await cp(database, join(scratch, 'database'), { recursive: true, dereference: false, errorOnExist: true, force: false });
    const { LocalDatabase } = await import(pathToFileURL(join(installed.directory, 'payload/dist/coordinator/local-database.js')).href);
    db = await LocalDatabase.open(join(scratch, 'database'));
    const existence = await db.query("SELECT to_regclass('workbench_coordinator.flow_instances') AS relation");
    if (!existence.rows[0]?.relation) return { activeFlows: 0, databasePresent: true };
    const result = await db.query("SELECT count(*)::integer AS count FROM workbench_coordinator.flow_instances WHERE state IN ('queued','preparing','starting','running','awaiting_input','paused','recovering','saving','review','export_failed')");
    assert.equal(result.rows[0]?.count, 0, 'Persisted managed flows require completion or recovery before upgrading');
    return { activeFlows: 0, databasePresent: true };
  } finally { await db?.close(); const temporary = await realpath(tmpdir()); inside(temporary, scratch); assert.ok(basename(scratch).startsWith('vesper-upgrade-database-')); await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}
async function installer(file, target) {
  assert.ok(!/[\r\n"]/.test(target), 'Invalid installer destination');
  await processesStopped();
  // NSIS requires /D last and unquoted, even when the directory has spaces.
  await new Promise((done, reject) => {
    const child = spawn(file, ['/S', '/currentuser', `/D=${target}`], { windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore' });
    child.once('error', reject); child.once('exit', code => code === 0 ? done() : reject(new Error(`Installer exited with ${code}`)));
  });
}

const product = JSON.parse(await asarText(browserRoot, 'desktop/product.json'));
assert.equal(product.product, 'browser');
const trustedKey = await asarText(browserRoot, 'desktop/update-public-key.pem');
// Existing MSIX-launched installs can record a logical APPDATA path while
// realpath resolves it into the caller's LocalCache. Validate that old registry
// against its original logical root before using its canonical directory.
let installed;
try { installed = await plugin.readInstalled(data); }
catch (error) {
  if (error.message !== 'Invalid installed add-on registry' || logicalData === data) throw error;
  installed = await plugin.readInstalled(logicalData);
}
const releaseRecord = await optionalJson(options['release-record'] ? resolve(options['release-record']) : join(release, 'DESKTOP-RELEASE.json'));
assert.equal(releaseRecord?.validation.windowsPackagedPair, true);
const versions = releaseRecord.products;
progress('Verifying signed release artifacts against the installed trust key.');
const browserUpdate = options['addon-only'] ? undefined : await update.verifyLocalUpdate(join(release, `browser/win32/Vesper-browser-${versions.browser}-win32-x64-full.exe.vesper-update.json`), trustedKey, { product: 'browser', platform: 'win32', arch: 'x64', version: product.version });
const workbenchVersion = workbenchRoot ? JSON.parse(await asarText(workbenchRoot, 'desktop/product.json')).version : installed?.version ?? '0.0.0';
const workbenchUpdate = options['addon-only'] ? undefined : await update.verifyLocalUpdate(join(release, `workbench/win32/Vesper-workbench-${versions.workbench}-win32-x64-full.exe.vesper-update.json`), trustedKey, { product: 'workbench', platform: 'win32', arch: 'x64', version: workbenchVersion });
const addon = await plugin.verifyPlugin(options['addon-only'] ? resolve(options['addon-manifest']) : join(release, `addons/Vesper-workbench-${versions.workbench}.vplugin.tgz.vesper-plugin.json`), trustedKey, { platform: 'win32', arch: 'x64' });
assert.ok(!installed || update.newer(addon.version, installed.version), 'Workbench add-on is not newer');
for (const artifact of options['addon-only'] ? [] : [browserUpdate, workbenchUpdate, addon]) {
  const expected = releaseRecord.artifacts.find(item => resolve(release, item.path) === resolve(artifact.file));
  assert.equal(artifact.sha256, expected?.sha256, 'Artifact does not match packaged release acceptance evidence');
}
report.current = { browser: product.version, workbench: installed?.version ?? null, addonEnabled: installed?.enabled ?? false };
report.artifacts = { ...(browserUpdate ? { browser: { version: browserUpdate.version, sha256: browserUpdate.sha256 } } : {}), ...(workbenchUpdate ? { workbenchInstaller: { version: workbenchUpdate.version, sha256: workbenchUpdate.sha256, willInstall: !!workbenchRoot } } : {}), addon: { version: addon.version, sha256: addon.sha256 } };
report.addonOnly = !!options['addon-only'];
report.guards = await guards();
report.steps = ['Copy and checksum the complete private data root to a new sibling backup.', 'Inspect managed flow activity on a disposable copy of the backup database; never open the live database.', 'Recheck stopped processes and unchanged source hashes.', ...(browserUpdate ? ['Apply the trusted Browser installer to its existing per-user installation.'] : []), ...(workbenchRoot ? ['Apply the trusted Workbench installer to its existing per-user installation.'] : []), 'Install the signed add-on into a new version directory and atomically replace only its registry.', 'Confirm every original private file remains byte-identical except the expected add-on registry.', 'Launch the upgraded Browser with the same explicit data root.'];
if (!options.apply) {
  report.databaseGuard = 'Pending offline backup-copy inspection during --apply; no live database is opened by dry-run';
  console.log(JSON.stringify(report, null, 2));
} else {
  const lock = await open(join(dirname(data), 'vesper-desktop-upgrade.lock'), 'wx', 0o600);
  try {
    await guards();
    progress('Inventorying private files before the backup.');
    const before = await inventory(data);
    const backup = options['resume-backup'] ? await validateResumeBackup(data, resolve(options['resume-backup'])) : join(dirname(data), 'vesper-upgrade-backups', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
    inside(dirname(data), backup); assert.ok(!backup.startsWith(data + sep));
    if (options['resume-backup']) {
      report.backupReused = true;
      progress('Rechecking the complete interrupted backup against every current source file; no checksum gate is skipped.');
    } else {
      await mkdir(backup, { recursive: true, mode: 0o700 });
      progress(`Copying private backup: ${before.length} files, ${before.reduce((sum, file) => sum + file.bytes, 0)} bytes.`);
      await cp(data, join(backup, 'data'), { recursive: true, dereference: false, errorOnExist: true, force: false });
    }
    progress('Verifying backup checksums.');
    assert.deepEqual(await inventory(join(backup, 'data')), before, 'Private backup checksum verification failed');
    await writeFile(join(backup, 'backup-manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), source: data, files: before }, null, 2), { mode: 0o600 });
    report.backup = backup;
    progress('Inspecting offline managed-flow activity on a disposable database copy.');
    report.databaseGuard = await inspectDatabaseCopy(backup, installed);
    await guards(); assert.deepEqual(await inventory(data), before, 'Private data changed after backup; upgrade stopped');
    if (browserUpdate) {
      assert.equal(await update.hashFile(browserUpdate.file), browserUpdate.sha256);
      progress('Applying the Browser installer to its existing per-user installation.');
      await installer(browserUpdate.file, browserRoot); report.actualInstallationChanged = true;
      assert.equal(JSON.parse(await asarText(browserRoot, 'desktop/product.json')).version, browserUpdate.version);
    }
    if (workbenchRoot) { assert.equal(await update.hashFile(workbenchUpdate.file), workbenchUpdate.sha256); await installer(workbenchUpdate.file, workbenchRoot); assert.equal(JSON.parse(await asarText(workbenchRoot, 'desktop/product.json')).version, workbenchUpdate.version); }
    await guards();
    const tar = createRequire(join(browserRoot, 'resources/payload/package.json'))('tar');
    progress('Installing the signed Workbench add-on atomically.');
    await plugin.installPlugin(addon, data, tar);
    report.actualInstallationChanged = true;
    // Keep the operator's prior enablement choice; installPlugin defaults true.
    const registryPath = join(data, 'plugins/workbench/installed.json'), registry = await optionalJson(registryPath);
    registry.enabled = installed?.enabled ?? false;
    const pending = registryPath + '.' + randomUUID(); await writeFile(pending, JSON.stringify(registry), { flag: 'wx', mode: 0o600 }); await rename(pending, registryPath);
    progress('Verifying preserved original private file checksums.');
    const preserved = before.filter(file => file.path !== join('plugins', 'workbench', 'installed.json'));
    assert.deepEqual(await hashPrivateInventory(data, preserved), preserved, 'An original private file changed unexpectedly');
    assert.equal((await plugin.readInstalled(data)).version, addon.version);
    report.checks.push('Backup verified', ...(browserUpdate ? ['Installed signed Browser version verified'] : []), 'Atomic signed add-on version verified', 'Original private data checksums preserved');
    await writeFile(join(backup, 'upgrade-result.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    if (!options['no-launch']) { progress('Launching the interactive Browser app with the preserved data store.'); const launchEnv = { ...process.env, VESPER_DESKTOP_DATA_DIR: data }; delete launchEnv.ELECTRON_RUN_AS_NODE; const child = spawn(join(browserRoot, 'vesper-browser.exe'), [], { env: launchEnv, detached: true, windowsHide: false, stdio: 'ignore' }); await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); }); child.unref(); report.launched = true; }
    console.log(JSON.stringify(report, null, 2));
  } finally { await lock.close(); await rm(join(dirname(data), 'vesper-desktop-upgrade.lock')); }
}
