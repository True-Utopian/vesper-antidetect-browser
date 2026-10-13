import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as tar from 'tar';
import {nativeExecutableHash,nativeRuntimeInventory} from '../packages/vesper-browser/src/native-kernel.js';
// @ts-expect-error Build scripts are distributed as JavaScript.
import {loadDesktopNativeBundle} from '../scripts/desktop-native-bundle.mjs';
// @ts-expect-error Build scripts are distributed as JavaScript.
import {createDeb,linuxArchiveMode} from '../scripts/linux-package.mjs';
// @ts-expect-error Build scripts are distributed as JavaScript.
import {prepareLinuxPortableInstaller} from '../scripts/linux-portable-installer.mjs';

const revision='owned-pinned-revision',chromiumVersion='157.0.0.0';
async function fixture(t:any,platform:'linux'|'win32'){
 const directory=await realpath(await mkdtemp(join(tmpdir(),'vesper-native-package-')));t.after(()=>rm(directory,{recursive:true,force:true}));
 const executable=platform==='linux'?'chrome':'chrome.exe',library=platform==='linux'?'libpolicy.so':'policy.dll';
 await writeFile(join(directory,executable),'Owned metadata fixture; never executed');await writeFile(join(directory,library),'Owned policy bytes');
 const sha=await nativeExecutableHash(join(directory,executable)),record={schemaVersion:1,author:'true-utopian',executable,revision,chromiumVersion,executableSha256:sha,nativeUnitExecutions:26,runtimeFiles:await nativeRuntimeInventory(join(directory,executable)),qualification:{state:'passed',implementation:'native-chromium-patches',nativeProof:true,executableSha256:sha,errors:[],surfacePolicies:['webgl-debug-restriction','offline-audio-seed','local-font-discovery'],cases:['baseline','seed-a','seed-a-restart','seed-b','invalid-fallback','surface-policy-a','surface-policy-a-restart','surface-policy-b','surface-policy-invalid'].map(name=>({name}))}};
 const path=join(directory,'vesper-kernel.json');await writeFile(path,JSON.stringify(record));return {directory,library,record,path,options:{platform,hostPlatform:platform,hostArch:'x64',full:true,revision,chromiumVersion}};
}

test('native bundling verifies complete launcher/library bytes for both platform manifests',async t=>{
 for(const platform of ['linux','win32'] as const){const f=await fixture(t,platform);assert.equal((await loadDesktopNativeBundle(f.path,f.options)).record.executable,f.record.executable);await writeFile(join(f.directory,f.library),'Changed component');await assert.rejects(loadDesktopNativeBundle(f.path,f.options),/runtime changed/);}
});

test('native bundling refuses host mismatch, light packages and incomplete or foreign qualification',async t=>{
 const f=await fixture(t,'linux');await assert.rejects(loadDesktopNativeBundle(f.path,{...f.options,hostPlatform:'win32'}),/matching host/);await assert.rejects(loadDesktopNativeBundle(f.path,{...f.options,full:false}),/full x64/);await assert.rejects(loadDesktopNativeBundle(f.path,{...f.options,directoryOnly:true}),/full x64/);
 await assert.rejects(loadDesktopNativeBundle(f.path,{...f.options,revision:'different-revision'}));
 f.record.qualification.cases.pop();await writeFile(f.path,JSON.stringify(f.record));await assert.rejects(loadDesktopNativeBundle(f.path,f.options),/nine native cases/);
});

test('actual Debian archive retains native launcher, libraries and sandbox executable permissions',async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-native-deb-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'app'),output=join(root,'output');await mkdir(join(directory,'resources/vesper-kernel'),{recursive:true});await mkdir(output);
 for(const name of ['vesper-browser','chrome-sandbox','resources/vesper-kernel/chrome','resources/vesper-kernel/chrome_sandbox','resources/vesper-kernel/libpolicy.so','resources/vesper-kernel/vesper-kernel.json'])await writeFile(join(directory,name),'Owned archive fixture; never executed');
 const file=await createDeb({directory,output,product:'browser',version:'1.0.0',description:'Owned native package fixture'}),bytes=await readFile(file);assert.equal(bytes.subarray(0,8).toString(),'!<arch>\n');let offset=8,data:Buffer|undefined;
 while(offset<bytes.length){const header=bytes.subarray(offset,offset+60),name=header.subarray(0,16).toString().trim().replace(/\/$/,''),size=Number(header.subarray(48,58).toString());assert.ok(Number.isSafeInteger(size)&&size>0);if(name==='data.tar.gz')data=bytes.subarray(offset+60,offset+60+size);offset+=60+size+(size%2);}
 assert.ok(data);const archive=join(root,'data.tar.gz');await writeFile(archive,data);const entries=new Map<string,number>();await tar.t({file:archive,onReadEntry:entry=>{if(entry.type==='File')entries.set(entry.path,entry.mode??0);}});
 for(const name of ['usr/bin/vesper-browser','opt/vesper-browser/vesper-browser','opt/vesper-browser/resources/vesper-kernel/chrome','opt/vesper-browser/resources/vesper-kernel/libpolicy.so'])assert.equal(entries.get(name)!&0o7777,0o755,name);
 for(const name of ['opt/vesper-browser/chrome-sandbox','opt/vesper-browser/resources/vesper-kernel/chrome_sandbox'])assert.equal(entries.get(name)!&0o7777,0o4755,name);
 assert.equal(entries.get('opt/vesper-browser/resources/vesper-kernel/vesper-kernel.json')!&0o7777,0o644);
});

test('portable installer installs once, preserves neighboring data and refuses changed package bytes',{skip:process.platform!=='linux'},async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-user-install-')));t.after(()=>rm(root,{recursive:true,force:true}));const source=join(root,'source'),prefix=join(root,'installed');await mkdir(source);await writeFile(join(source,'vesper-browser'),'Owned executable fixture; never launched');await writeFile(join(root,'profiles.txt'),'Original private fixture data');await prepareLinuxPortableInstaller(source,{product:'browser',version:'1.0.0'});
 const run=()=>promisify(execFile)('sh',[join(source,'install.sh'),'--prefix',prefix,'--no-launcher']);await run();assert.equal(await readFile(join(prefix,'browser/1.0.0/vesper-browser'),'utf8'),'Owned executable fixture; never launched');await assert.rejects(run(),error=>{assert.equal((error as any).code,4);return true;});assert.equal(await readFile(join(root,'profiles.txt'),'utf8'),'Original private fixture data');
 await writeFile(join(source,'vesper-browser'),'Changed package');await assert.rejects(run(),error=>{assert.equal((error as any).code,3);return true;});assert.equal(await readFile(join(prefix,'browser/1.0.0/vesper-browser'),'utf8'),'Owned executable fixture; never launched');
});

test('portable archive retains its root launcher, sandbox helper and other upstream executables',async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-native-portable-')));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const name of ['vesper-browser','chrome-sandbox','install.sh','settings.json'])await writeFile(join(root,name),'Owned archive fixture; never executed');
 const archive=join(root,'portable.tar.gz');await tar.c({cwd:root,file:archive,gzip:true,portable:true,filter:(path:string,entry:any)=>{if(entry.isFile())entry.mode=linuxArchiveMode(path,entry.mode,'browser');return true;}},['vesper-browser','chrome-sandbox','install.sh','settings.json']);
 const modes=new Map<string,number>();await tar.t({file:archive,onReadEntry:entry=>modes.set(entry.path.replace(/^\.\//,''),entry.mode??0)});
 assert.equal(modes.get('vesper-browser')!&0o7777,0o755);assert.equal(modes.get('chrome-sandbox')!&0o7777,0o4755);assert.equal(modes.get('install.sh')!&0o7777,0o755);assert.equal(modes.get('settings.json')!&0o7777,0o644);
 assert.equal(linuxArchiveMode('chrome_crashpad_handler',0o755,'browser')&0o7777,0o755);assert.equal(linuxArchiveMode('resources/vesper-kernel/another-native-helper',0o755,'browser')&0o7777,0o755);
});
