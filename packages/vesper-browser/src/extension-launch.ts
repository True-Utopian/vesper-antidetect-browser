import { access, cp, lstat, mkdtemp, realpath, rm, rmdir, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Chrome also opens extension storage beneath userDataDir with legacy paths.
 * A short process-only profile junction preserves the original data directory.
 */
export async function profileLaunchPath(directory: string) {
  if (process.platform !== 'win32' || directory.length < 140) return { path: directory, cleanup: async () => {} };
  const root = await mkdtemp(join(tmpdir(), 'vesper-profile-launch-')), alias = join(root, 'profile');
  if (alias.length >= 140) { await rmdir(root); throw new Error('Use a shorter Windows temporary directory for browser profile storage'); }
  let pending: Promise<void> | undefined;
  const cleanup = () => pending ??= (async () => {
    try { if (!(await lstat(alias)).isSymbolicLink()) throw new Error('Browser profile launch alias changed'); await unlink(alias); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await rmdir(root).catch(error => { if (error.code !== 'ENOENT') throw error; });
  })();
  try { await symlink(await realpath(directory), alias, 'junction'); return { path: alias, cleanup }; }
  catch (error) { await cleanup(); throw error; }
}

/** Chromium's extension loader uses legacy Windows paths and comma-separated flags.
 * Keep portable profile packages in place and give this process short private copies.
 * Junctions are insufficient: Chromium canonicalizes content-script paths.
 * A manifest public key, assigned at import, keeps the browser identity stable.
 */
export async function extensionLaunchPaths(paths: string[]) {
  if (!paths.some(path => path.includes(',') || process.platform === 'win32' && join(path, 'manifest.json').length >= 240)) {
    return { paths, cleanup: async () => {} };
  }
  const root = await mkdtemp(join(tmpdir(), 'vesper-extension-launch-'));
  const physicalRoot = await realpath(root);
  const links: string[] = [];
  let pending: Promise<void> | undefined;
  const cleanup = () => pending ??= (async () => {
    // Resolve the exact owned temporary directory before any recursive deletion.
    try {
      if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== physicalRoot) throw new Error('Extension launch directory changed');
      await rm(physicalRoot, { recursive: true, force: true });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  })();
  try {
    for (const [index, path] of paths.entries()) {
      const link = join(root, 'ext-' + index);
      if (link.includes(',') || process.platform === 'win32' && join(link, 'manifest.json').length >= 240) throw new Error('Use a short temporary directory without commas to load extensions');
      const target = await realpath(path);
      await cp(target, link, { recursive: true, errorOnExist: true, force: false, dereference: false }); links.push(link);
      await access(join(link, 'manifest.json'));
    }
    return { paths: links, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
