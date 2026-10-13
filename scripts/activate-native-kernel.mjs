import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import puppeteer from 'puppeteer-core';
import { VesperBrowserClient } from '../packages/vesper-browser/dist/client.js';
import { nativeExecutableHash, verifyNativeRuntime, assertNativeSurfacePolicies } from '../packages/vesper-browser/dist/native-kernel.js';
import {observeNativeSurfacePolicies,assertRestrictedSurfaces} from '../packages/vesper-browser/dist/native-surface-qualification.mjs';
import { zipFiles } from './fixtures/extension-package.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++)if(args[i]==='--activate')options.activate=true;
else if(args[i]==='--packaged')options.packaged=true;
else if(['--manifest','--data-root'].includes(args[i])&&args[i+1])options[args[i].slice(2)]=args[++i];
else throw Error('Usage: activate-native-kernel.mjs --manifest <qualified vesper-kernel.json> --data-root <running desktop store> [--activate] [--packaged]');
assert.ok(options.manifest&&options['data-root'],'Provide the copied runtime manifest and running desktop data root');
const manifestPath=await realpath(resolve(options.manifest)),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const source=JSON.parse(await readFile(new URL('../native/chromium/kernel.json',import.meta.url),'utf8'));
assert.equal(manifest.schemaVersion,1);assert.equal(manifest.author,'true-utopian');assert.equal(manifest.revision,source.revision);
assert.equal(manifest.nativeUnitExecutions,26);assert.equal(manifest.qualification?.nativeProof,true);
assert.equal(manifest.qualification?.state,'passed');assert.deepEqual(manifest.qualification.errors,[]);
const surfacePolicy={protection:'standard',webgl:'restricted',audio:'seeded',fonts:'restricted'};
assertNativeSurfacePolicies(manifest.qualification,surfacePolicy);
assert.ok(['chrome.exe','chrome'].includes(manifest.executable));
const executable=await realpath(join(dirname(manifestPath),manifest.executable));
assert.equal(await nativeExecutableHash(executable),manifest.executableSha256);
assert.equal(manifest.qualification.executableSha256,manifest.executableSha256);
await verifyNativeRuntime(executable,manifest.runtimeFiles);
assert.equal(manifest.patchHashes.length,source.patches.length);
for(const patch of source.patches){const record=manifest.patchHashes.find(p=>p.path===patch);assert.ok(record);assert.equal(record.sha256,await nativeExecutableHash(new URL('../native/chromium/patches/'+patch,import.meta.url)));}
const data=await realpath(resolve(options['data-root']));
async function service(kind){
 const record=JSON.parse(await readFile(join(data,kind,'service.json'),'utf8'));assert.equal(record.version,1);assert.ok(Number.isInteger(record.port)&&record.port>0&&record.port<65536);
 const token=(await readFile(join(data,kind,'admin-token'),'utf8')).trim(),url=`http://127.0.0.1:${record.port}`;
 const api=async(path,method='GET',body)=>{const response=await fetch(url+path,{method,signal:AbortSignal.timeout(240000),redirect:'error',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error(kind+': '+response.status+' '+await response.text());return response.headers.get('content-type')?.includes('json')?response.json():Buffer.from(await response.arrayBuffer());};
 return {api,url,tokenFile:join(data,kind,'admin-token')};
}
const browser=await service('browser'),workbench=await service('workbench'),busy=new Set(['queued','preparing','starting','running','paused','awaiting_input','recovering','saving','review','export_failed']);
const browserCapabilities=await browser.api('/api/v1/fingerprint/capabilities');
assert.ok(browserCapabilities.engines?.vesper?.pendingSurfacePolicies?.includes('offline-audio-seed'),'Install the desktop surface-policy release before native activation');
async function idle(){
 assert.ok((await browser.api('/api/v1/profiles')).every(p=>p.state!=='running'&&!p.lease),'Stop owned profiles before native activation');
 assert.ok((await workbench.api('/api/v1/runs')).every(r=>!busy.has(r.state)&&!r.cleanupRequired),'Finish Workbench runs and cleanup before native activation');
 assert.ok((await workbench.api('/api/v1/schedules')).every(s=>!s.enabled&&!['running','admitting'].includes(s.state)),'Pause schedules before native activation');
}
await idle();const report={at:new Date().toISOString(),state:'preflight-passed',scope:options.packaged?'Isolated packaged desktop':'Actual installed desktop',actualInstalledProof:!options.packaged,nativeProof:true,installedKernelChanged:false,executableSha256:manifest.executableSha256,checks:['Copied runtime/native proof/26 unit executions/patch hashes verified','Browser profiles, run ownership and schedules are idle'],errors:[]};
if(!options.activate){console.log(JSON.stringify(report));}
else{
 const output=resolve('test-results/native-kernel');await mkdir(output,{recursive:true});const temporary=await mkdtemp(join(tmpdir(),'vesper-native-integration-'));
 const snapshot=p=>({id:p.id,name:p.name,settings:p.settings,folder:p.folder,tags:p.tags,notes:p.notes,favorite:p.favorite,trashed:p.trashed});
 const original=(await browser.api('/api/v1/profiles')).map(snapshot);let runId,connection,fixture;
 try{
  const staged=await browser.api('/api/v1/engine/native/stage','POST',{executablePath:executable});await idle();
  const activation=await browser.api('/api/v1/engine/activate','POST',{family:'vesper',buildId:staged.buildId});
  assert.equal(activation.qualification.nativeProof,true);assert.equal(activation.qualification.executableSha256,manifest.executableSha256);
  assertNativeSurfacePolicies(activation.qualification,surfacePolicy);
  report.installedKernelChanged=true;report.activation={buildId:staged.buildId,profilesBackedUp:activation.profilesBackedUp,backup:activation.backup};
  const zip=join(temporary,'owned-native-extension.zip');
  await writeFile(zip,zipFiles({
   'manifest.json':JSON.stringify({manifest_version:3,name:'Vesper native integration proof',version:'1.0.0',background:{service_worker:'worker.js'},content_scripts:[{matches:['http://127.0.0.1/*'],js:['content.js'],run_at:'document_end'}]}),
   'worker.js':`const observeNativeSurfacePolicies=${observeNativeSurfacePolicies.toString()};const first=(async()=>{const canvas=new OffscreenCanvas(16,8),ctx=canvas.getContext('2d');ctx.fillStyle='#cd4567';ctx.fillRect(1,1,14,6);return {cpu:navigator.hardwareConcurrency,memory:navigator.deviceMemory,pixels:[...ctx.getImageData(0,0,16,8).data],surfaces:await observeNativeSurfacePolicies()};})();chrome.runtime.onMessage.addListener((msg,_sender,respond)=>{if(msg.kind!=='native-proof')return;first.then(respond);return true;});`,
   'content.js':`chrome.runtime.sendMessage({kind:'native-proof'},result=>{document.documentElement.dataset.vesperNativeProof=JSON.stringify(chrome.runtime.lastError?{error:chrome.runtime.lastError.message}:result);});`,
  }));
  const client=new VesperBrowserClient({url:browser.url,tokenFile:browser.tokenFile,timeoutMs:240000}),extension=await client.importExtension(zip);
  fixture=createServer((request,response)=>{response.setHeader('content-type','text/html');response.setHeader('accept-ch','Sec-CH-Device-Memory');response.end(`<!doctype html><title>Owned native integration fixture</title><script>const observeNativeSurfacePolicies=${observeNativeSurfacePolicies.toString()};const canvas=document.createElement('canvas');canvas.width=16;canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#cd4567';ctx.fillRect(1,1,14,6);window.first={cpu:navigator.hardwareConcurrency,memory:navigator.deviceMemory,pixels:[...ctx.getImageData(0,0,16,8).data]};window.nativeSurfaces=observeNativeSurfacePolicies(true);</script><h1>Vesper native Browser and Workbench by true-utopian</h1>`);});
  await new Promise(done=>fixture.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${fixture.address().port}`;
  const run=await workbench.api('/api/v1/runs','POST',{automationId:'inspect',inputs:{url,engine:'vesper',protection:'standard',webgl:'restricted',audio:'seeded',fonts:'restricted',cpu:4,deviceMemory:4,extensions:[extension.id]},preset:'fast'});runId=run.id;
  async function waitRun(states){const deadline=Date.now()+120000;while(Date.now()<deadline){const r=await workbench.api('/api/v1/runs/'+runId);if(states.includes(r.state))return r;if(['failed','cancelled','interrupted','export_failed'].includes(r.state))throw Error(r.state+': '+r.error);await new Promise(done=>setTimeout(done,200));}throw Error('Native Workbench fixture timed out');}
  const live=await waitRun(['running']);await client.claimProfile(live.profileId,runId);
  connection=await puppeteer.connect({browserWSEndpoint:await client.connectionUrl(live.profileId),defaultViewport:null});
  const target=await connection.waitForTarget(t=>t.type()==='page'&&t.url().startsWith(url),{timeout:20000}),page=await target.page();assert.ok(page);
  await page.waitForFunction(()=>document.documentElement.dataset.vesperNativeProof,{timeout:20000});
  report.firstScript=await page.evaluate(()=>({page:window.first,extension:JSON.parse(document.documentElement.dataset.vesperNativeProof)}));
  report.firstScript.page.surfaces=await page.evaluate(()=>window.nativeSurfaces);
  const baseline=manifest.qualification.cases.find(value=>value.name==='baseline').contexts;
  assertRestrictedSurfaces(baseline.page.surfaces,report.firstScript.page.surfaces,'installed-page',true);
  assertRestrictedSurfaces(baseline['extension-startup-worker'].surfaces,report.firstScript.extension.surfaces,'installed-startup-worker');
  const runningProfile=await client.readProfile(live.profileId);
  assert.deepEqual(runningProfile.settings.fingerprint,surfacePolicy,'Workbench must retain each requested native policy');
  for(const value of Object.values(report.firstScript)){assert.equal(value.cpu,4);assert.equal(value.memory,4);}
  assert.deepEqual(report.firstScript.page.pixels,report.firstScript.extension.pixels,'Native canvas must agree between page and startup extension worker');
  await connection.disconnect();connection=undefined;await workbench.api('/api/v1/runs/'+runId+'/finish','POST',{});
  const saved=await waitRun(['saved']),artifact=await workbench.api('/api/v1/runs/'+runId+'/artifact');assert.equal(createHash('sha256').update(artifact).digest('hex'),saved.artifact.sha256);
  report.run={id:runId,profileId:live.profileId,state:saved.state,archiveBytes:artifact.length,sha256:saved.artifact.sha256};
  assert.deepEqual((await browser.api('/api/v1/profiles')).filter(p=>original.some(o=>o.id===p.id)).map(snapshot),original);await idle();
  report.surfacePolicies=activation.qualification.surfacePolicies;
  report.checks.push('Fresh host native qualification and stopped-profile backup before activation','Workbench runs the exact native binary with page/startup-extension CPU 4, memory 4 and coherent canvas','Installed profile retains GPU/audio/font controls and enforces their owned page/startup-worker observations','Finish closes the fixture and saves a checksum-verified archive','Original profile settings and metadata preserved; leases released');report.state='passed';
 }catch(error){report.state='failed';report.errors.push(error.stack||String(error));process.exitCode=1;}
 finally{await connection?.disconnect().catch(()=>{});if(runId&&report.state!=='passed')await workbench.api('/api/v1/runs/'+runId+'/cancel','POST',{}).catch(error=>report.errors.push('Owned fixture cleanup: '+error.message));if(fixture)await new Promise(done=>fixture.close(done));const child=relative(await realpath(tmpdir()),await realpath(temporary));assert.ok(child.startsWith('vesper-native-integration-')&&!child.startsWith('..')&&!isAbsolute(child));await rm(temporary,{recursive:true,force:true});report.completedAt=new Date().toISOString();await writeFile(join(output,options.packaged?'packaged-native-integration.json':'installed-native-integration.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({state:report.state,nativeProof:report.nativeProof,installedKernelChanged:report.installedKernelChanged,run:report.run,errors:report.errors}));
}
