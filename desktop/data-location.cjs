const { lstatSync, readFileSync, realpathSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, linkSync, unlinkSync } = require('node:fs');
const { join, resolve, dirname, isAbsolute } = require('node:path');
const { homedir } = require('node:os');
const { randomUUID } = require('node:crypto');

function info(file) {
  try { return lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}
function pointerFile(home = homedir()) { return join(home, '.vesper', 'desktop-location.json'); }
function samePath(a, b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }
function existingRoot(root) {
  if (typeof root !== 'string' || !isAbsolute(root) || /[\0\r\n]/.test(root)) throw Error('Vesper data location must be an absolute directory');
  const canonical = realpathSync(root);
  if (!lstatSync(canonical).isDirectory()) throw Error('Configured Vesper data location is not a directory');
  return canonical;
}
function readPointer(file) {
  const record = info(file);
  if (!record) return undefined;
  if (!record.isFile() || record.isSymbolicLink() || record.size > 65536) throw Error('Invalid Vesper desktop location file');
  let value;
  try { value = JSON.parse(readFileSync(file, 'utf8')); } catch { throw Error('Invalid Vesper desktop location JSON'); }
  if (value?.schemaVersion !== 1) throw Error('Unsupported Vesper desktop location schema');
  try { return existingRoot(value.dataRoot); }
  catch (error) { throw Error('Configured Vesper data directory is unavailable; restore its location before starting Vesper. ' + error.message); }
}

// Both desktop products consult the same home-directory pointer. Unlike APPDATA,
// this path does not change when launched through an MSIX-packaged terminal.
// Explicit fixture/operator overrides take precedence; a broken saved location
// must never silently create an empty profile store somewhere else.
function resolveDesktopDataRoot({ override, home = homedir(), defaultRoot }) {
  if (override) return resolve(override);
  return readPointer(pointerFile(home)) ?? resolve(defaultRoot);
}
function preflightDesktopDataRoot(dataRoot, { home = homedir() } = {}) {
  const root = existingRoot(dataRoot), file = pointerFile(home), parent = info(dirname(file));
  if (parent && (!parent.isDirectory() || parent.isSymbolicLink())) throw Error('Vesper desktop location parent must be an ordinary directory');
  const current = readPointer(file);
  if (current && !samePath(current, root)) throw Error('Another Vesper data directory is already configured; existing profiles were not moved');
  return { file, dataRoot: root, alreadyConfigured: !!current };
}
function registerDesktopDataRoot(dataRoot, options = {}) {
  const checked = preflightDesktopDataRoot(dataRoot, options);
  if (checked.alreadyConfigured) return { ...checked, created: false };
  mkdirSync(dirname(checked.file), { recursive: true, mode: 0o700 });
  // Check again after creating the parent, then publish a complete immutable
  // file exclusively. Existing configuration is never overwritten, even if a
  // second installer races this one.
  preflightDesktopDataRoot(checked.dataRoot, options);
  const temporary = checked.file + '.' + randomUUID() + '.pending';
  let fd, created = false;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify({ schemaVersion: 1, dataRoot: checked.dataRoot }, null, 2) + '\n');
    fsyncSync(fd); closeSync(fd); fd = undefined;
    try { linkSync(temporary, checked.file); created = true; }
    catch (error) { if (error.code !== 'EEXIST') throw error; preflightDesktopDataRoot(checked.dataRoot, options); }
  } finally { if (fd !== undefined) closeSync(fd); if (info(temporary)) unlinkSync(temporary); }
  return { ...preflightDesktopDataRoot(checked.dataRoot, options), created };
}

module.exports = { resolveDesktopDataRoot, preflightDesktopDataRoot, registerDesktopDataRoot };
