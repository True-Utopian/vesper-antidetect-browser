import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { VesperBrowser, VesperBrowserClient, browserAccessToken, createBrowserServer } from '../src/index.js';
import { InputVault } from '../src/storage.js';
import { validateProxyChoice } from '../src/proxies.js';

const connection = { value: 'http' as const, extra: { host:'127.0.0.1', port:18888, id:'owned-user', secret:'owned-test-password-unique' } };
test('saved proxy snapshots stay encrypted, independent and durable through catalog edits and removal', async () => {
  const directory = await mkdtemp(join(tmpdir(),'vesper-proxy-vault-'));
  let browser = new VesperBrowser({directory,executablePath:process.execPath});
  try {
    const saved = await browser.saveProxy({name:'Owned connection',connection});
    const a = await browser.create({name:'First'}), b = await browser.create({name:'Second'});
    const created = await browser.create({name:'Created with saved connection',savedProxy:{id:saved.id,revision:1}});
    assert.equal((await browser.readProfile(created.id)).hasProxy,true);
    assert.equal('savedProxy' in (await browser.readProfile(created.id)).settings,false);
    await assert.rejects(browser.create({savedProxy:{id:saved.id,revision:9}}),{status:412});
    await assert.rejects(browser.create({savedProxy:{id:saved.id,revision:1},proxy:connection}),/Invalid saved proxy reference/);
    await assert.rejects(browser.update(created.id,{savedProxy:{id:saved.id,revision:1}}),{status:400});
    await browser.assignProxy(a.id,saved.id,1); await browser.assignProxy(b.id,saved.id,1);
    const publicList = JSON.stringify(await browser.proxies());
    assert.ok(!publicList.includes(connection.extra.secret)); assert.ok(!publicList.includes(connection.extra.id));
    assert.equal(saved.hasPassword,true); assert.equal(saved.hasUsername,true);
    const sealed = (await readdir(join(directory,'proxy-inventory'))).find(x=>x.endsWith('.sealed'))!;
    assert.equal((await readFile(join(directory,'proxy-inventory',sealed))).includes(Buffer.from(connection.extra.secret)),false);
    assert.equal(JSON.stringify(await browser.readProfile(a.id)).includes(connection.extra.secret),false);
    const edited = await browser.saveProxy({revision:1,name:'New label',connection:{value:'socks5',extra:{host:'::1',port:18889}}},saved.id);
    assert.equal(edited.revision,2); assert.equal(edited.createdAt,saved.createdAt); assert.equal(edited.hasPassword,true);
    const vault = new InputVault(join(directory,'secrets')); await vault.init();
    assert.deepEqual(await vault.get(created.id),connection);
    assert.deepEqual(await vault.get(a.id),connection);
    await assert.rejects(browser.assignProxy(b.id,saved.id,1),{status:412});
    await browser.assignProxy(b.id,saved.id,2);
    assert.deepEqual(await vault.get(b.id),{value:'socks5',extra:{...connection.extra,host:'::1',port:18889}});
    const cleared = await browser.saveProxy({revision:2,connection:{value:'socks5',extra:{host:'::1',port:18889,id:'',secret:''}}},saved.id);
    assert.equal(cleared.hasPassword,false); assert.equal(cleared.hasUsername,false);
    await browser.close(); browser = new VesperBrowser({directory,executablePath:process.execPath});
    assert.equal((await browser.proxies())[0]?.revision,3);
    await browser.removeProxy(saved.id,3);
    assert.deepEqual(await browser.proxies(),[]); assert.deepEqual(await vault.get(a.id),connection);
    assert.equal((await browser.readProfile(a.id)).hasProxy,true);
    await assert.rejects(browser.assignProxy(a.id,saved.id,3),{status:404});
    await browser.close(); browser = new VesperBrowser({directory,executablePath:process.execPath});
    assert.deepEqual(await browser.proxies(),[]);
  } finally { await browser.close(); await rm(directory,{recursive:true,force:true}); }
});

test('saved proxy API enforces credentials redaction, revision conflicts, leases and live-session guards',async()=>{
  const directory = await mkdtemp(join(tmpdir(),'vesper-proxy-api-'));
  const browser = new VesperBrowser({directory,executablePath:process.execPath}), token = await browserAccessToken(directory), server = await createBrowserServer(browser,token);
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done)); const address=server.address();assert.ok(address&&typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}`, client=new VesperBrowserClient({url,tokenFile:join(directory,'admin-token')});
  const request=(path:string,method='GET',data?:unknown)=>fetch(url+'/api/v1'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  let sessionFile:string|undefined;
  try {
    const saved=await client.saveProxy({name:'Local test',connection}),profile=await browser.create({name:'Owned profile'});
    const inventory=await client.proxies();assert.deepEqual(inventory,[saved]);
    assert.equal((await fetch(url+'/api/v1/proxies')).status,401);
    assert.equal((await request('/proxies/'+saved.id,'GET')).status,405,'credential readback is unavailable');
    assert.equal((await request('/proxies/'+saved.id,'PATCH',{name:'Missing revision'})).status,400);
    assert.equal((await request('/proxies/'+saved.id,'DELETE',{revision:99})).status,412);
    await client.claimProfile(profile.id,randomUUID());
    assert.equal((await request('/profiles/'+profile.id+'/proxy','POST',{proxyId:saved.id,revision:1})).status,409);
    assert.equal((await browser.readProfile(profile.id)).hasProxy,false);
    await client.assignProxy(profile.id,saved.id,1);
    await client.releaseProfile(profile.id);
    sessionFile=join(directory,'profiles',profile.id,'session.json');
    await writeFile(sessionFile,JSON.stringify({pid:process.pid,endpoint:'ws://127.0.0.1:18880/devtools/browser/'+randomUUID()}));
    assert.equal((await request('/profiles/'+profile.id+'/proxy','POST',{proxyId:saved.id,revision:1})).status,409);
    await rm(sessionFile);sessionFile=undefined;
    const competing=await Promise.all([request('/proxies/'+saved.id,'PATCH',{revision:1,name:'A'}),request('/proxies/'+saved.id,'PATCH',{revision:1,name:'B'})]);
    assert.deepEqual(competing.map(x=>x.status).sort(),[200,412]);
    const latest=(await client.proxies())[0]!;assert.equal(latest.revision,2);
    await assert.rejects(client.assignProxy(profile.id,saved.id,1),{status:412});
    await client.removeProxy(saved.id,2);assert.equal((await browser.readProfile(profile.id)).hasProxy,true);
    const schema=await(await request('/openapi.json')).json() as any;
    assert.ok(schema.paths['/proxies']);assert.ok(schema.paths['/profiles/{id}/proxy']);
    assert.equal((await request('/templates','POST',{name:'Reference excluded',settings:{savedProxy:{id:saved.id,revision:2}}})).status,400);
    const events=await(await request('/events')).json() as any;
    assert.ok(events.events.some((e:any)=>e.type==='profile.proxy-assigned'));
    assert.ok(!JSON.stringify(events).includes(connection.extra.secret));
  } finally { if(sessionFile)await rm(sessionFile,{force:true}); await new Promise<void>(done=>server.close(()=>done())); await browser.close(); await rm(directory,{recursive:true,force:true}); }
});

test('proxy validation rejects malformed endpoints and unsupported or unbounded credentials',()=>{
  for(const invalid of [null,[],{}, {...connection,extra:{...connection.extra,host:'bad/path'}},{...connection,extra:{...connection.extra,host:'bad\\path'}},{...connection,extra:{...connection.extra,port:65536}},{...connection,extra:{...connection.extra,id:'bad:name'}},{...connection,extra:{...connection.extra,secret:'x'.repeat(4097)}},{...connection,extra:{...connection.extra,secret:'bad\nvalue'}},{...connection,extra:{...connection.extra,rotationUrl:'http://elsewhere'}}]) assert.throws(()=>validateProxyChoice(invalid));
  assert.deepEqual(validateProxyChoice({value:'socks5',extra:{host:'::1',port:1080}}),{value:'socks5',extra:{host:'::1',port:1080}});
});
