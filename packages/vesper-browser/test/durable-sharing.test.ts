import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, writeFile, readFile, readdir, rm, mkdir, access } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { durableWrite, atomicRename } from '../src/storage.js';
import { VesperBrowser } from '../src/browser.js';
import { holdWindowsFile } from './fixtures/windows-file-lock.js';

test('a real transient Windows sharing lock delays atomic publish without losing snapshot bytes', {skip:process.platform !== 'win32',timeout:20000}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-sharing-')); t.after(() => rm(directory, {recursive:true,force:true}));
  const file=join(directory,'snapshot.json');await writeFile(file,'original');const release=await holdWindowsFile(file);let published=false;
  const writing=durableWrite(file,'replacement').then(()=>{published=true;}); void writing.catch(()=>{});
  try { await new Promise(done=>setTimeout(done,150));assert.equal(published,false); } finally { await release(); }
  await writing;assert.equal(await readFile(file,'utf8'),'replacement');assert.deepEqual(await readdir(directory),['snapshot.json']);
});

test('a persistent Windows sharing lock fails within its retry ceiling and retains both recoverable versions', {skip:process.platform !== 'win32',timeout:20000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'vesper-sharing-ceiling-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=join(directory,'snapshot.json');await writeFile(file,'original');const release=await holdWindowsFile(file),started=Date.now();
  try { await assert.rejects(durableWrite(file,'replacement'),(error:any)=>['EPERM','EBUSY','EACCES'].includes(error.code));assert.ok(Date.now()-started<10000);const temporary=(await readdir(directory)).filter(x=>x.endsWith('.tmp'));assert.equal(temporary.length,1);assert.equal(await readFile(join(directory,temporary[0]!),'utf8'),'replacement'); } finally { await release(); }
  assert.equal(await readFile(file,'utf8'),'original');
});

test('an extracted directory publishes after a real Windows child-file sharing lock clears', {skip:process.platform !== 'win32',timeout:20000}, async t=>{
 const directory=await mkdtemp(join(tmpdir(),'vesper-directory-sharing-'));t.after(()=>rm(directory,{recursive:true,force:true}));const source=join(directory,'staging'),destination=join(directory,'published');await mkdir(source);await writeFile(join(source,'owned.json'),'owned-directory');const release=await holdWindowsFile(join(source,'owned.json')),pending=atomicRename(source,destination);void pending.catch(()=>{});
 try{await new Promise(done=>setTimeout(done,150));await access(source);await assert.rejects(access(destination),{code:'ENOENT'});}finally{await release();}
 await pending;assert.equal(await readFile(join(destination,'owned.json'),'utf8'),'owned-directory');await assert.rejects(access(source),{code:'ENOENT'});
});

test('profile archive import survives a real extracted-file sharing lock without altering its original', {skip:process.platform !== 'win32',timeout:20000}, async t=>{
 const directory=await mkdtemp(join(tmpdir(),'vesper-import-sharing-'));t.after(()=>rm(directory,{recursive:true,force:true}));const browser=new VesperBrowser({directory:join(directory,'store'),executablePath:process.execPath});const rename=fs.rename;let release:(()=>Promise<void>)|undefined,timer:ReturnType<typeof setTimeout>|undefined,observedErrors=0;
 try{
  const original=await browser.create({name:'Owned import source',engine:'chromium'}),file=join(directory,'owned.tgz'),marker='{"ownedArchive":"sharing-fixture"}';await writeFile(join(directory,'store/profiles',original.id,'browser/Local State'),marker);await browser.export(original.id,file);const archive=await readFile(file);
  fs.rename=async(source,destination)=>{
   const selected=String(source).replaceAll('\\','/').endsWith('/browser')&&String(destination).replaceAll('\\','/').includes('/profiles/');
   if(selected&&!release){release=await holdWindowsFile(join(String(source),'Local State'));timer=setTimeout(()=>void release!(),150);}
   try{return await rename(source,destination);}catch(error){if(selected)observedErrors++;throw error;}
  };syncBuiltinESMExports();
  const imported=await browser.importProfile(file);assert.ok(observedErrors>0,'The fixture must exercise an actual denied directory rename');assert.notEqual(imported.id,original.id);assert.equal((await browser.listProfiles()).length,2);assert.equal(await readFile(join(directory,'store/profiles',imported.id,'browser/Local State'),'utf8'),marker);assert.equal(await readFile(join(directory,'store/profiles',original.id,'browser/Local State'),'utf8'),marker);assert.deepEqual(await readFile(file),archive);
 }finally{if(timer)clearTimeout(timer);await release?.();fs.rename=rename;syncBuiltinESMExports();await browser.close();}
});
