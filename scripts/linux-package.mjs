import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as tar from 'tar';

// Debian packages are ar containers of metadata + POSIX tar archives. This deliberately
// avoids a Windows fpm/WSL dependency; native installation still needs Linux qualification.
function arMember(name, data) {
  const header = `${(name + '/').padEnd(16)}${'0'.padEnd(12)}${'0'.padEnd(6)}${'0'.padEnd(6)}${'100644'.padEnd(8)}${String(data.length).padEnd(10)}\x60\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), data, ...(data.length % 2 ? [Buffer.from('\n')] : [])]);
}
export function linuxArchiveMode(path,mode,product){
  const name=path.replaceAll('\\','/').replace(/^\.\//,'');
  const sandbox=name==='chrome-sandbox'||name.endsWith('/chrome-sandbox')||/resources\/(vesper-kernel|chromium)\/chrome_sandbox$/.test(name);
  const executable=!!(mode&0o111)||name===`vesper-${product}`||name===`usr/bin/vesper-${product}`||name.endsWith(`/vesper-${product}`)||name==='install.sh'||name===`opt/vesper-${product}/install.sh`||/resources\/(vesper-kernel|chromium)\/chrome$/.test(name)||/\.so(\.[0-9.]+)?$/.test(name);
  return (mode&~0o7777)|(sandbox?0o4755:executable?0o755:0o644);
}
export async function createDeb({ directory, output, product, version, description }) {
  const work = join(output, 'deb-stage'), control = join(work, 'control'), data = join(work, 'data');
  const packageName = `vesper-${product}`;
  await mkdir(control, { recursive: true }); await mkdir(join(data, 'opt'), { recursive: true });
  await cp(directory, join(data, 'opt', packageName), { recursive: true, verbatimSymlinks:true });
  await mkdir(join(data, 'usr/share/applications'), { recursive: true }); await mkdir(join(data, 'usr/bin'), { recursive: true });
  await writeFile(join(control, 'control'), `Package: ${packageName}\nVersion: ${version}\nArchitecture: amd64\nMaintainer: true-utopian\nSection: devel\nPriority: optional\nDepends: libgtk-3-0, libnss3, libxss1, libasound2 | libasound2t64, libgbm1, libatk-bridge2.0-0, libdrm2, libxkbcommon0, libx11-xcb1, libxcb-dri3-0\nDescription: ${description}\n Open-source desktop application by true-utopian.\n`);
  await writeFile(join(data, 'usr/bin', packageName), `#!/bin/sh\nexec /opt/${packageName}/${packageName} "$@"\n`);
  await writeFile(join(data, 'usr/share/applications', `${packageName}.desktop`), `[Desktop Entry]\nType=Application\nName=Vesper ${product === 'browser' ? 'Browser' : 'Workbench'}\nComment=By true-utopian\nExec=${packageName} %U\nIcon=/opt/${packageName}/resources/icon.png\nTerminal=false\nCategories=Development;\n`);
  const controlArchive = join(work, 'control.tar.gz'), dataArchive = join(work, 'data.tar.gz');
  await tar.c({ cwd: control, file: controlArchive, gzip: true, portable: true, noMtime: true }, ['control']);
  await tar.c({ cwd: data, file: dataArchive, gzip: true, portable: true, noMtime: true, filter: (_path, entry) => {
    if (entry.isFile()) {
      entry.mode=linuxArchiveMode(_path,entry.mode,product);
    }
    return true;
  } }, ['opt', 'usr']);
  const file = join(output, `${packageName}_${version}_amd64.deb`);
  await writeFile(file, Buffer.concat([Buffer.from('!<arch>\n'), arMember('debian-binary', Buffer.from('2.0\n')), arMember('control.tar.gz', await readFile(controlArchive)), arMember('data.tar.gz', await readFile(dataArchive))]));
  return file;
}
