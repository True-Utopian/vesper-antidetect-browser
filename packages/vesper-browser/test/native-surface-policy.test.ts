import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {nativeProfileArguments,assertNativeSurfacePolicies,type NativeKernelReport} from '../src/native-kernel.js';
import {validateFingerprint} from '../src/native-preferences.js';
import {VesperBrowser} from '../src/browser.js';

const policy={protection:'standard',webgl:'restricted',audio:'seeded',fonts:'restricted'} as const;
test('native surface settings reject malformed modes and incompatible engines before profile mutation',async()=>{
  for(const invalid of [{...policy,audio:true},{...policy,fonts:'random'},{...policy,webgl:'Restricted'},{...policy,protection:'off'}])assert.throws(()=>validateFingerprint(invalid));
  assert.deepEqual(validateFingerprint(policy),policy);
  const root=await mkdtemp(join(tmpdir(),'vesper-native-surface-settings-'));
  const browser=new VesperBrowser({directory:root,executablePath:process.execPath});
  try{
    await assert.rejects(browser.create({engine:'brave',fingerprint:policy}),/require Vesper/);
    const profile=await browser.create({engine:'vesper',fingerprint:policy});
    await assert.rejects(browser.update(profile.id,{engine:'chromium'}),/require Vesper/);
    assert.deepEqual((await browser.readProfile(profile.id)).settings.fingerprint,policy);
  }finally{await browser.close();await rm(root,{recursive:true,force:true});}
});
test('adding an audio identity preserves the previous canvas seed and persists across restart and archive import',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vesper-native-audio-identity-'));
  const browser=new VesperBrowser({directory:join(root,'store')});
  try{
    const profile=await browser.create({engine:'vesper',fingerprint:policy});
    const directory=join(root,'store','profiles',profile.id,'browser');
    const firstCanvas=await nativeProfileArguments(directory,{fingerprint:{protection:'standard'}});
    const first=await nativeProfileArguments(directory,{fingerprint:policy});
    assert.ok(first.includes(firstCanvas[0]));
    assert.ok(first.includes('--vesper-webgl-policy=restricted'));
    assert.ok(first.includes('--vesper-local-font-policy=restricted'));
    assert.deepEqual(await nativeProfileArguments(directory,{fingerprint:policy}),first);
    const archive=join(root,'owned.vprofile');await browser.export(profile.id,archive);
    const imported=await browser.importProfile(archive);
    assert.deepEqual(await nativeProfileArguments(join(root,'store','profiles',imported.id,'browser'),{fingerprint:policy}),first);
    const fresh=await browser.create({engine:'vesper',fingerprint:policy});
    const independent=await nativeProfileArguments(join(root,'store','profiles',fresh.id,'browser'),{fingerprint:policy});
    assert.notEqual(independent.find(value=>value.startsWith('--vesper-audio-seed=')),first.find(value=>value.startsWith('--vesper-audio-seed=')));
  }finally{await browser.close();await rm(root,{recursive:true,force:true});}
});
test('a damaged audio seed is rejected without replacing either persisted identity',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vesper-native-audio-corrupt-'));
  const file=join(root,'.vesper-native-policy.json');
  const bytes=JSON.stringify({schemaVersion:1,canvasSeed:'0123456789abcdef',audioSeed:'damaged'});
  try{
    await writeFile(file,bytes);
    await assert.rejects(nativeProfileArguments(root,{fingerprint:policy}),/Invalid persisted native audio/);
    assert.equal(await readFile(file,'utf8'),bytes);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('legacy or failed native receipts cannot admit unqualified surface policies',()=>{
  const receipt={state:'passed',nativeProof:true,surfacePolicies:['webgl-debug-restriction','offline-audio-seed','local-font-discovery']} as NativeKernelReport;
  assert.doesNotThrow(()=>assertNativeSurfacePolicies(receipt,policy));
  assert.doesNotThrow(()=>assertNativeSurfacePolicies(undefined,{protection:'off'}));
  for(const invalid of [undefined,{...receipt,surfacePolicies:undefined},{...receipt,state:'failed'},{...receipt,nativeProof:false},{...receipt,surfacePolicies:['webgl-debug-restriction','offline-audio-seed']}])assert.throws(()=>assertNativeSurfacePolicies(invalid as NativeKernelReport,policy),/lacks qualification/);
});
