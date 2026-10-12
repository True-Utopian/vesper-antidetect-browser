import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {VesperBrowser,browserAccessToken,createBrowserServer} from '../src/index.js';

test('profile organization, independent templates, bulk replay and lease boundaries survive restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'vesper-expanded-'));
 const browser=new VesperBrowser({directory,executablePath:process.execPath});
 const token=await browserAccessToken(directory),server=await createBrowserServer(browser,token);
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address!=='string');
 const origin=`http://127.0.0.1:${address.port}`;
 const request=async(route:string,method='GET',data?:unknown,extra={})=>fetch(origin+'/api/v1'+route,{method,headers:{authorization:`Bearer ${token}`,...(data?{'content-type':'application/json'}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});
 try {
  const template=await (await request('/templates','POST',{name:'Research',settings:{folder:'Research',tags:['owned'],notes:'Independent',engine:'brave',environment:{hardwareConcurrency:4,webRTC:'proxy-only'}}})).json() as any;
  assert.ok(template.id);
  const profile=await (await request(`/templates/${template.id}/create-profile`,'POST',{name:'One'})).json() as any;
  assert.ok(profile.id);
  assert.equal((await request(`/templates/${template.id}`,'PATCH',{name:'Research',settings:{folder:'Changed'}})).status,200);
  assert.equal((await browser.readProfile(profile.id)).settings.folder,'Research');
  assert.equal((await request('/templates','POST',{name:'Unsafe copy',settings:{proxy:{}}})).status,400);
  assert.equal((await request('/profiles','POST',{environment:{hardwareConcurrency:0}})).status,400);
  assert.equal((await request('/profiles','POST',{environment:{canvas:'fake'}})).status,400);
  assert.equal((await request(`/profiles/${profile.id}/cookies`,'POST',{})).status,400);
  assert.equal((await request(`/profiles/${profile.id}/trash`,'POST')).status,200);
  assert.equal((await browser.listProfiles()).length,0);
  assert.equal((await (await request('/profiles?trash=1')).json() as any[]).length,1);
  assert.equal((await request(`/profiles/${profile.id}/start`,'POST')).status,409);
  assert.equal((await request(`/profiles/${profile.id}/restore`,'POST')).status,200);
  const bulk={ids:[profile.id],action:'duplicate'},headers={'idempotency-key':'bulk-independent-copy'};
  const first=await(await request('/profiles/bulk','POST',bulk,headers)).json();
  assert.deepEqual(await(await request('/profiles/bulk','POST',bulk,headers)).json(),first);
  assert.equal((await browser.listProfiles()).length,2);
  assert.equal((await request(`/profiles/${profile.id}/lease`,'POST',{runId:randomUUID()})).status,200);
  assert.equal((await request('/profiles/bulk','POST',{ids:[profile.id],action:'trash'})).status,409);
  assert.equal((await request(`/profiles/${profile.id}/environment`)).status,409);
  assert.equal((await browser.readProfile(profile.id)).trashedAt,undefined);
  const contract=await(await request('/openapi.json')).json() as any;assert.ok(contract.paths['/templates']);assert.ok(contract.paths['/profiles/{id}/cookies']);
 }finally{await new Promise<void>(done=>server.close(()=>done()));await browser.close();}
 const reopened=new VesperBrowser({directory,executablePath:process.execPath});try{assert.equal((await reopened.listProfiles()).length,2);assert.equal((await reopened.listProfiles())[0]?.settings.notes,'Independent');}finally{await reopened.close();await rm(directory,{recursive:true,force:true});}
});
