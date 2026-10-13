import { build, Platform, Arch } from 'electron-builder';
import { Resvg } from '@resvg/resvg-js';
import { cp, mkdir, readFile, writeFile, readdir, stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as tar from 'tar';
import { createDeb, linuxArchiveMode } from './linux-package.mjs';
import { updateKey, signLocalUpdate } from './local-update-signing.mjs';
import { nativeExecutableHash, verifyNativeRuntime } from '../packages/vesper-browser/dist/native-kernel.js';
import { qualifyNativeKernel } from '../packages/vesper-browser/dist/native-qualification.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadDesktopNativeBundle } from './desktop-native-bundle.mjs';
import { prepareLinuxPortableInstaller } from './linux-portable-installer.mjs';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2), product = args[0] ?? 'browser', platform = args[1] ?? process.platform;
if (!['browser', 'workbench'].includes(product) || !['win32', 'linux'].includes(platform)) throw new Error('Usage: desktop-build.mjs <browser|workbench> <win32|linux> [--dir] [--full]');
const full = args.includes('--full'), output = join(root, 'release', product, platform);
const kernelIndex = args.indexOf('--native-kernel-manifest');
let nativeKernel;
if (kernelIndex >= 0) {
  if (!args[kernelIndex + 1] || args[kernelIndex + 1].startsWith('--')) throw new Error('Missing --native-kernel-manifest path');
  const pinned=JSON.parse(await readFile(join(root,'native/chromium/kernel.json'),'utf8'));
  nativeKernel=await loadDesktopNativeBundle(resolve(args[kernelIndex+1]),{platform,full,directoryOnly:args.includes('--dir'),revision:pinned.revision,chromiumVersion:pinned.chromiumVersion});
}
const stage = join(root, '.desktop-build', product, platform);
await mkdir(stage, { recursive: true }); await mkdir(output, { recursive: true });
const metadata = JSON.parse(await readFile(join(root, product === 'browser' ? 'packages/vesper-browser/package.json' : 'package.json'), 'utf8'));
const name = product === 'browser' ? 'Vesper Browser' : 'Vesper Workbench';
const rootPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const payload = join(stage, 'payload'); await mkdir(payload, { recursive: true });
for (const entry of product === 'browser' ? ['packages/vesper-browser', 'docs', 'LICENSE'] : ['dist', 'public', 'schemas', 'packages/vesper-browser', 'automations', 'flows', 'docs', 'LICENSE']) {
  await cp(join(root, entry), join(payload, entry), { recursive: true, filter: path => !/[\\/](node_modules|test)[\\/]/.test(path) });
}
const dependencies = product === 'browser' ? {} : { ...rootPackage.dependencies };
delete dependencies['@kameleo/local-api-client'];
dependencies['@true-utopian/vesper-browser'] = 'file:packages/vesper-browser';
const payloadPackage = { name: `@true-utopian/vesper-${product}`, version: metadata.version, type: 'module', private: true, author: 'true-utopian', license: 'MIT', ...(product === 'workbench' ? { exports: rootPackage.exports } : {}), dependencies };
await writeFile(join(payload, 'package.json'), JSON.stringify(payloadPackage, null, 2));
await new Promise((done, reject) => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: payload, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
  child.once('error', reject); child.once('exit', code => code === 0 ? done() : reject(new Error(`Payload dependency installation failed (${code})`)));
});
// Keep the exact installed dependency manifest alongside its notices.
const notices = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (entry.name.startsWith('@')) { await collect(path); continue; }
    try {
      const pkg = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
      const licenses = (await readdir(path)).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file));
      notices.push(`\n${pkg.name} ${pkg.version}\nLicense: ${JSON.stringify(pkg.license ?? 'see package notice')}\n${(await Promise.all(licenses.map(file => readFile(join(path, file), 'utf8').catch(() => '')))).join('\n')}`);
    } catch {}
    try { await collect(join(path, 'node_modules')); } catch {}
  }
}
await collect(join(payload, 'node_modules'));
await writeFile(join(payload, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
await mkdir(join(stage, 'desktop'), { recursive: true });
for (const file of ['main.cjs', 'service.mjs','bundled-kernel.mjs','service-process.cjs','preload.cjs','update-contract.cjs','seed-files.mjs','plugin-contract.cjs','workbench-host.cjs']) await cp(join(root, 'desktop', file), join(stage, 'desktop', file));
await writeFile(join(stage,'desktop/update-public-key.pem'),(await updateKey()).publicKey);
await writeFile(join(stage, 'desktop/product.json'), JSON.stringify({ product, name, version: metadata.version, bundledBrowser: full, bundledBrowserPath: platform==='linux'&&nativeKernel?'vesper-kernel':'chromium', bundledNativeKernel: !!nativeKernel }));
const icon = (await readFile(join(root, 'public/vesper-icon.png'))).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><image width="256" height="256" href="data:image/png;base64,${icon}"/></svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
await writeFile(join(stage, 'desktop/icon.png'), png);
const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[8] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile(join(stage, 'desktop/icon.ico'), Buffer.concat([header, png]));
await writeFile(join(root, 'desktop/icon.png'), png); // Development desktop uses the same original vector mark.
await writeFile(join(stage, 'package.json'), JSON.stringify({ name: `vesper-${product}`, productName: name, version: metadata.version, description: metadata.description, author: { name: 'true-utopian' }, license: 'MIT', main: 'desktop/main.cjs' }, null, 2));
const resources = [{ from: payload, to: 'payload' }, { from: join(root, 'desktop/service.mjs'), to: 'runtime/service.mjs' }, { from: join(root, 'desktop/bundled-kernel.mjs'), to: 'runtime/bundled-kernel.mjs' }, { from: join(stage, 'desktop/icon.png'), to: 'icon.png' }];
if (full && !(platform==='linux'&&nativeKernel)) {
  if (platform !== 'win32') throw new Error('A full Linux installer requires a Linux Chromium cache. Use the light installer on this PC.');
  const record = JSON.parse(await readFile(join(root, '.workbench/local-engine/browser.json'), 'utf8'));
  resources.push({ from: dirname(record.executablePath), to: 'chromium', filter: ['**/*', '!**/*_tests.exe', '!**/*.pdb'] });
}
const artifacts = await build({ projectDir: stage, publish: 'never', targets: (platform === 'win32' ? Platform.WINDOWS : Platform.LINUX).createTarget(args.includes('--dir') || platform === 'linux' ? 'dir' : 'nsis', Arch.x64), config: {
  appId: `io.true-utopian.vesper.${product}`, productName: name, executableName: `vesper-${product}`, electronVersion: rootPackage.devDependencies.electron,
  directories: { output }, files: ['desktop/**/*', 'package.json', '!node_modules/**/*'], extraResources: resources, asar: true, npmRebuild: false,
  artifactName: `Vesper-${product}-${metadata.version}-${platform}-x64${full ? '-full' : ''}.\${ext}`,
  win: { icon: join(stage, 'desktop/icon.ico'), signAndEditExecutable: true, requestedExecutionLevel: 'asInvoker' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false, createDesktopShortcut: true, runAfterFinish: false, uninstallDisplayName: `${name} by true-utopian`, ...(nativeKernel ? { include: join(root, 'desktop/native-runtime-install.nsh') } : {}) },
  afterPack: async context => {
    // electron-builder's dependency collector excludes node_modules from this auxiliary
    // resource tree. The sidecar has an explicit production-only tree of its own.
    const destination = join(context.appOutDir, 'resources/payload/node_modules');
    await cp(join(payload, 'node_modules'), destination, { recursive: true, dereference: true });
    await stat(join(destination, 'puppeteer-core/package.json'));
    if (product === 'workbench') { await stat(join(destination, '@electric-sql/pglite/package.json')); await stat(join(destination, 'fastify/package.json')); }
    try { await stat(join(destination, '@kameleo')); throw new Error('Vendor SDK unexpectedly entered the standalone payload'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (nativeKernel) {
      const target = join(context.appOutDir, 'resources/vesper-kernel');
      await mkdir(target, { recursive: false });
      if(platform==='win32'){
        const ps = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0');
        await promisify(execFile)(join(ps, 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-File', join(root, 'scripts/prepare-native-runtime-access.ps1'), '-Directory', target], { windowsHide: true, env: { ...process.env, PSModulePath: join(ps, 'Modules') } });
      }
      await cp(nativeKernel.directory, target, { recursive: true, verbatimSymlinks:true, filter: path => !['sandbox-runtime-access.json', 'native-qualification.json', 'vesper-kernel.json'].includes(path.split(/[\\/]/).at(-1)) });
      const executable = join(target, nativeKernel.record.executable);
      await verifyNativeRuntime(executable, nativeKernel.record.runtimeFiles);
      const proof = await qualifyNativeKernel(executable);
      if (proof.state !== 'passed' || !proof.nativeProof || proof.executableSha256 !== nativeKernel.record.executableSha256) throw new Error(`Installer native qualification failed: ${proof.errors.join('; ')}`);
      await writeFile(join(output, `native-qualification-${metadata.version}.json`), JSON.stringify(proof, null, 2));
      await writeFile(join(target, 'vesper-kernel.json'), JSON.stringify({ ...nativeKernel.record, qualification: { ...proof, executable: nativeKernel.record.executable } }, null, 2));
    }
  },
  linux: { icon: join(stage, 'desktop/icon.png'), category: 'Development', maintainer: 'true-utopian', target: ['deb'], synopsis: metadata.description },
} });
if (platform === 'linux') {
  const directory = join(output, 'linux-unpacked');
  await prepareLinuxPortableInstaller(directory,{product,version:metadata.version});
  await createDeb({ directory, output, product, version: metadata.version, description: metadata.description });
  await tar.c({ cwd: directory, gzip: true, file: join(output, `Vesper-${product}-${metadata.version}-linux-x64.tar.gz`), portable: true, filter: (path, entry) => {
    if (entry.isFile()) entry.mode = linuxArchiveMode(path,entry.mode,product); return true;
  } }, ['.']);
}
const hashes = [];
const installer = platform === 'win32' ? join(output,`Vesper-${product}-${metadata.version}-${platform}-x64${full?'-full':''}.exe`) : join(output,`vesper-${product}_${metadata.version}_amd64.deb`);
if (platform === 'linux' || !args.includes('--dir')) await signLocalUpdate({file:installer,product,platform,version:metadata.version});
for (const file of await readdir(output)) {
  if (!(await stat(join(output, file))).isFile() || file === 'SHA256SUMS') continue;
  const hash = createHash('sha256'); for await (const chunk of createReadStream(join(output, file))) hash.update(chunk);
  hashes.push(`${hash.digest('hex')}  ${file}`);
}
await writeFile(join(output, 'SHA256SUMS'), hashes.join('\n') + '\n');
console.log(`${name} by true-utopian packaged locally: ${output}`);
