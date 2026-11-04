import { mkdir, writeFile, open, stat, rename, mkdtemp, rm, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, relative, isAbsolute, resolve, parse } from 'node:path';
import * as tar from 'tar';

// Debian packages are ar containers of metadata + POSIX tar archives. This deliberately
// avoids a Windows fpm/WSL dependency; native installation still needs Linux qualification.
function arHeader(name, size) {
  if (!Number.isSafeInteger(size) || size < 0 || size > 9999999999) throw Error('Debian archive member exceeds the supported size');
  return Buffer.from(`${(name + '/').padEnd(16)}${'0'.padEnd(12)}${'0'.padEnd(6)}${'0'.padEnd(6)}${'100644'.padEnd(8)}${String(size).padEnd(10)}\x60\n`, 'ascii');
}
async function dataArchive(directory, metadata, file, packageName, product) {
  const app = await realpath(directory), launchers = await realpath(metadata), cwd = parse(app).root;
  const child = (base, absolute) => { const path = relative(base, absolute); return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))) ? path.replaceAll('\\', '/') : undefined; };
  const mapped = absolute => {
    const path = resolve(absolute), appPath = child(app, path);
    if (appPath !== undefined) return 'opt/' + packageName + (appPath ? '/' + appPath : '');
    const launcherPath = child(launchers, path); if (launcherPath?.startsWith('usr')) return launcherPath;
    throw Error('Debian archive entry escaped application/launcher roots');
  };
  // One filesystem pack owns backpressure and hard-link ordering. Repacking
  // parser entries into another pack can deadlock on component-build links.
  await tar.c({ cwd, file, gzip: true, portable: true, noMtime: true, onWriteEntry: entry => {
    entry.path = mapped(entry.absolute) + (entry.type === 'Directory' ? '/' : '');
    if (entry.type === 'Link') entry.linkpath = mapped(resolve(cwd, entry.linkpath));
    if (entry.stat.isFile()) entry.stat.mode = linuxArchiveMode(entry.path, entry.stat.mode, product);
  } }, [relative(cwd, app), relative(cwd, join(launchers, 'usr'))]);
}
async function writeDeb(file, controlArchive, contentsArchive) {
  const handle = await open(file, 'wx', 0o644);
  try {
    await handle.writeFile(Buffer.from('!<arch>\n'));
    await handle.writeFile(arHeader('debian-binary', 4)); await handle.writeFile(Buffer.from('2.0\n'));
    for (const [name, source] of [['control.tar.gz', controlArchive], ['data.tar.gz', contentsArchive]]) {
      const size = (await stat(source)).size; await handle.writeFile(arHeader(name, size));
      for await (const chunk of createReadStream(source)) await handle.writeFile(chunk);
      if (size % 2) await handle.writeFile(Buffer.from('\n'));
    }
    await handle.sync();
  } finally { await handle.close(); }
}
export function linuxArchiveMode(path,mode,product){
  const name=path.replaceAll('\\','/').replace(/^\.\//,'');
  const sandbox=name==='chrome-sandbox'||name.endsWith('/chrome-sandbox')||/resources\/(vesper-kernel|chromium)\/chrome_sandbox$/.test(name);
  const executable=!!(mode&0o111)||name===`vesper-${product}`||name===`usr/bin/vesper-${product}`||name.endsWith(`/vesper-${product}`)||name==='install.sh'||name===`opt/vesper-${product}/install.sh`||/resources\/(vesper-kernel|chromium)\/chrome$/.test(name)||/\.so(\.[0-9.]+)?$/.test(name);
  return (mode&~0o7777)|(sandbox?0o4755:executable?0o755:0o644);
}
export async function createDeb({ directory, output, product, version, description }) {
  await mkdir(output, { recursive: true });
  const work = await mkdtemp(join(await realpath(output), '.deb-stage-')), control = join(work, 'control'), data = join(work, 'data');
  try {
  const packageName = `vesper-${product}`;
  await mkdir(control, { recursive: true });
  await mkdir(join(data, 'usr/share/applications'), { recursive: true }); await mkdir(join(data, 'usr/bin'), { recursive: true });
  await writeFile(join(control, 'control'), `Package: ${packageName}\nVersion: ${version}\nArchitecture: amd64\nMaintainer: true-utopian\nSection: devel\nPriority: optional\nDepends: libgtk-3-0, libnss3, libxss1, libasound2 | libasound2t64, libgbm1, libatk-bridge2.0-0, libdrm2, libxkbcommon0, libx11-xcb1, libxcb-dri3-0\nDescription: ${description}\n Open-source desktop application by true-utopian.\n`);
  await writeFile(join(data, 'usr/bin', packageName), `#!/bin/sh\nexec /opt/${packageName}/${packageName} "$@"\n`);
  await writeFile(join(data, 'usr/share/applications', `${packageName}.desktop`), `[Desktop Entry]\nType=Application\nName=Vesper ${product === 'browser' ? 'Browser' : 'Workbench'}\nComment=By true-utopian\nExec=${packageName} %U\nIcon=/opt/${packageName}/resources/icon.png\nTerminal=false\nCategories=Development;\n`);
  const controlArchive = join(work, 'control.tar.gz'), contentsArchive = join(work, 'data.tar.gz');
  await tar.c({ cwd: control, file: controlArchive, gzip: true, portable: true, noMtime: true }, ['control']);
  await dataArchive(directory, data, contentsArchive, packageName, product);
  const file = join(output, `${packageName}_${version}_amd64.deb`);
  const pending = join(work, 'package.deb'); await writeDeb(pending, controlArchive, contentsArchive); await rename(pending, file);
  return file;
  } finally {
    // Release compressed temporary members before portable compression. An
    // interrupted build cannot leave a partial final Debian package.
    if (await realpath(work) !== work) throw new Error('Refusing to remove a redirected Debian staging directory');
    await rm(work, { recursive: true, force: true });
  }
}
