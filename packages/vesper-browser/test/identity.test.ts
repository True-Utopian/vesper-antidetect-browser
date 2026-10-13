import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditIdentity,identityEnvironment,type IdentityObservation} from '../src/identity.js';
import {VesperBrowser} from '../src/browser.js';
import {browserAccessToken,createBrowserServer} from '../src/server.js';
import {VesperBrowserClient} from '../src/client.js';

const observed: IdentityObservation={userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0 Safari/537.36',platform:'Win32',languages:['en-GB'],hardwareConcurrency:4,deviceMemory:4,locale:'en-GB',timezone:'Europe/London',screen:{width:1920,height:1080,pixelRatio:1},viewport:{width:1280,height:800},clientHints:{platform:'Windows',fullVersionList:[{brand:'Not A Brand',version:'99.0.0.0'},{brand:'Chromium',version:'157.0.8100.0'}]}};
test('native identity contracts reject conflicting overrides and retain unrelated policy',()=>{
  assert.deepEqual(identityEnvironment('desktop-4','vesper',{webRTC:'proxy-only'}),{hardwareConcurrency:4,deviceMemory:4,webRTC:'proxy-only'});
  for(const [preset,engine,environment]of [['missing','vesper',{}],['desktop-4','chromium',{}],['native','vesper',{hardwareConcurrency:4}],['desktop-4','vesper',{deviceMemory:8}],['desktop-8','vesper',{screen:{width:1920,height:1080,deviceScaleFactor:1}}],['native','vesper',{webGL:'disabled'}]] as const)assert.throws(()=>identityEnvironment(preset,engine,environment));
  assert.deepEqual(identityEnvironment('custom','chromium',{hardwareConcurrency:7}),{hardwareConcurrency:7});
});
test('identity audit uses reduced UA major and exact native hints, exposing mismatches and unavailable hints',()=>{
  const settings={locale:'en-GB',timezone:'Europe/London',environment:{hardwareConcurrency:4,deviceMemory:4 as const}};
  assert.equal(auditIdentity(observed,settings,'Chrome/157.0.8100.0').state,'passed');
  const mismatch=auditIdentity({...observed,hardwareConcurrency:8,clientHints:{platform:'Linux',fullVersionList:[{brand:'Chromium',version:'156.0.8100.0'}]}},settings,'Chrome/157.0.8100.0');
  assert.deepEqual(mismatch.checks.filter(value=>value.state==='mismatch').map(value=>value.id),['hint-version','platform','cpu']);
  assert.equal(auditIdentity({...observed,clientHints:null},settings,'Chrome/157.0.8100.0').state,'incomplete');
  assert.equal(auditIdentity({...observed,viewport:{width:2000,height:800}},settings,'Chrome/157.0.8100.0').state,'mismatch');
});
test('preset changes, rejected edits, legacy settings and archives preserve the profile contract',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vesper-identity-contract-')),browser=new VesperBrowser({directory});
  try {
    const legacy=await browser.create({engine:'chromium',environment:{hardwareConcurrency:7}});
    assert.equal((await browser.readProfile(legacy.id)).settings.identityPreset,undefined);
    const {id}=await browser.create({engine:'vesper',identityPreset:'desktop-4',environment:{webRTC:'proxy-only'}});
    const before=await readFile(join(directory,'profiles',id,'manifest.json'),'utf8');
    await assert.rejects(browser.update(id,{environment:{hardwareConcurrency:8}}),/conflicts/);
    assert.equal(await readFile(join(directory,'profiles',id,'manifest.json'),'utf8'),before);
    await browser.update(id,{identityPreset:'desktop-8'});
    assert.deepEqual((await browser.readProfile(id)).settings.environment,{webRTC:'proxy-only',hardwareConcurrency:8,deviceMemory:8});
    await browser.update(id,{identityPreset:'native'});
    assert.deepEqual((await browser.readProfile(id)).settings.environment,{webRTC:'proxy-only'});
    await browser.update(id,{identityPreset:'custom',environment:{hardwareConcurrency:3}});
    assert.deepEqual((await browser.readProfile(id)).settings.environment,{hardwareConcurrency:3});
    await browser.update(id,{identityPreset:'desktop-4',environment:{}});
    const archive=join(directory,'identity.tgz');await browser.export(id,archive);
    const imported=await browser.importProfile(archive);
    const {name:_importedName,...importedSettings}=(await browser.readProfile(imported.id)).settings;
    const {name:_originalName,...originalSettings}=(await browser.readProfile(id)).settings;
    assert.deepEqual(importedSettings,originalSettings);
  } finally {await browser.close();await rm(directory,{recursive:true,force:true});}
});
test('fingerprint report separates requested, qualified and running policies, including protection off',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vesper-identity-coverage-')),browser=new VesperBrowser({directory});
  try {
    const {id}=await browser.create({engine:'vesper',fingerprint:{protection:'standard',webgl:'restricted',audio:'seeded',fonts:'restricted'}});
    let report=await browser.fingerprintReport(id);
    assert.ok(report.nativeKernel!.coverage.every(value=>value.requested&&!value.qualified&&!value.active));
    await writeFile(join(directory,'selected-native-kernel.json'),JSON.stringify({qualification:{state:'passed',nativeProof:true,executableSha256:'owned-fixture',surfacePolicies:['webgl-debug-restriction','offline-audio-seed','local-font-discovery']}}));
    report=await browser.fingerprintReport(id);
    assert.ok(report.nativeKernel!.coverage.every(value=>value.requested&&value.qualified&&!value.active));
    assert.equal(report.nativeKernel!.qualification.verification.includes('does not rehash'),true);
    await browser.update(id,{fingerprint:{protection:'off'}});
    assert.ok((await browser.fingerprintReport(id)).nativeKernel!.coverage.every(value=>!value.requested&&!value.active));
    assert.equal((await browser.fingerprintReport(id)).nativeKernel!.canvasSeed,'disabled');
  } finally {await browser.close();await rm(directory,{recursive:true,force:true});}
});
test('authenticated identity API validates the same contract and publishes its schema',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'vesper-identity-api-')),browser=new VesperBrowser({directory});
  const token=await browserAccessToken(directory),server=await createBrowserServer(browser,token);
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const origin='http://127.0.0.1:'+(server.address() as {port:number}).port,headers={authorization:'Bearer '+token,'content-type':'application/json'};
  try {
    assert.equal((await fetch(origin+'/api/v1/identity/presets')).status,401);
    const presets=await (await fetch(origin+'/api/v1/identity/presets',{headers})).json();assert.equal(presets.length,4);
    const contract=await (await fetch(origin+'/api/v1/openapi.json',{headers})).json();assert.ok(contract.paths['/identity/presets']);assert.ok(contract.components.schemas.Profile.properties.settings.properties.identityPreset);
    const invalid=await fetch(origin+'/api/v1/profiles',{method:'POST',headers,body:JSON.stringify({engine:'vesper',identityPreset:'desktop-4',environment:{hardwareConcurrency:8}})});assert.equal(invalid.status,400);
    assert.equal((await browser.listProfiles()).length,0);
    const creation=await fetch(origin+'/api/v1/profiles',{method:'POST',headers,body:JSON.stringify({engine:'vesper',identityPreset:'desktop-8'})});assert.equal(creation.status,201);
    const {id}=await creation.json();assert.equal((await browser.readProfile(id)).settings.environment?.deviceMemory,8);
    const client=new VesperBrowserClient({url:origin,tokenFile:join(directory,'admin-token')});
    assert.deepEqual(await client.identityPresets(),presets);
    assert.equal((await client.fingerprintReport(id)).identityPreset,'desktop-8');
    await assert.rejects(client.environmentReport(id),/not running/);
  } finally {await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));await browser.close();await rm(directory,{recursive:true,force:true});}
});
