import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { extensionZip, zipFiles } from '../../../scripts/fixtures/extension-package.mjs';
import { VesperBrowser, VesperBrowserClient, browserAccessToken, createBrowserServer } from '../src/index.js';

test('extension versions are immutable, independently assigned and portable without the original catalog', async () => {
  const root = await mkdtemp(join(tmpdir(),'vesper-extension-'));
  const browser = new VesperBrowser({ directory: join(root,'a') }), other = new VesperBrowser({ directory: join(root,'b') });
  try {
    const file = join(root,'extension.zip'); await writeFile(file,extensionZip());
    const one = await browser.installExtension(file), repeat = await browser.installExtension(file);
    assert.deepEqual(one,repeat); assert.deepEqual(one.hostPermissions,['http://127.0.0.1/*']);
    await writeFile(file,extensionZip('2.0.0')); const two = await browser.installExtension(file);
    assert.notEqual(one.id,two.id); assert.equal((await browser.extensions()).length,2);
    const first = await browser.create({ extensions: [one.id] }), second = await browser.create({ extensions: [two.id] });
    const archive = join(root,'profile.tgz'); await browser.export(first.id,archive);
    const imported = await other.importProfile(archive);
    assert.equal((await other.extensions()).length,0);
    assert.deepEqual(await other.profileExtensions(imported.id),[one]);
    await other.update(imported.id,{extensions:[]}); assert.deepEqual(await other.profileExtensions(imported.id),[]);
    await other.update(imported.id,{extensions:[one.id]}); assert.deepEqual(await other.profileExtensions(imported.id),[one]);
    await assert.rejects(browser.create({extensions:['0'.repeat(64)]}),/ENOENT/);
    assert.equal((await browser.listProfiles()).length,2);
    const installed = join(root,'a','profiles',first.id,'browser','.vesper-extensions',one.id,'content.js');
    await writeFile(installed,'changed after assignment');
    await assert.rejects(browser.export(first.id,join(root,'bad.tgz')),/package changed/);
    assert.deepEqual(await browser.profileExtensions(second.id),[two]);
    assert.equal((await browser.extensions()).find(item=>item.id===one.id)?.version,'1.0.0');
  } finally { await other.close(); await browser.close(); await rm(root,{recursive:true,force:true}); }
});

test('extension uploads require authentication, validate ZIPs and retain lease protection on assignment', async () => {
  const root = await mkdtemp(join(tmpdir(),'vesper-extension-api-'));
  const browser = new VesperBrowser({directory:root}), token = await browserAccessToken(root);
  const server = await createBrowserServer(browser,token); await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const address=server.address();assert.ok(address && typeof address!=='string'); const url=`http://127.0.0.1:${address.port}`;
  const client = new VesperBrowserClient({url,tokenFile:join(root,'admin-token')});
  try {
    const file=join(root,'extension.zip');await writeFile(file,extensionZip());
    assert.equal((await fetch(url+'/api/v1/extensions/import',{method:'POST',headers:{'content-type':'application/zip'},body:extensionZip()})).status,401);
    const installed=await client.importExtension(file);assert.deepEqual(await client.extensions(),[installed]);
    assert.deepEqual((await client.capabilities() as any).capabilities.extensions,{manifestVersions:[3],localPackages:true,perProfile:true});
    const profile=await client.create({name:'run-'+randomUUID(),extensions:[installed.id]});
    await assert.rejects(new VesperBrowserClient({url,tokenFile:join(root,'admin-token')}).update(profile.id,{extensions:[]}),error=>(error as any).status===409);
    assert.deepEqual(await client.profileExtensions(profile.id),[installed]);
    await client.releaseProfile(profile.id);await client.update(profile.id,{extensions:[]});assert.deepEqual(await client.profileExtensions(profile.id),[]);
    for(const entries of [{'manifest.json':JSON.stringify({manifest_version:2,name:'legacy',version:'1.0'})},{'../escape':'owned'},{'manifest.json':'invalid JSON'}]) {
      await writeFile(file,zipFiles(entries));await assert.rejects(client.importExtension(file));
    }
    assert.equal((await client.extensions()).length,1);
    assert.ok((await readdir(join(root,'extensions'))).every(name=>/^[a-f0-9]{64}$/.test(name)));
    assert.deepEqual((await client.readProfile(profile.id)).settings.extensions,[]);
  } finally { await client.close();await new Promise<void>(done=>server.close(()=>done()));await browser.close();await rm(root,{recursive:true,force:true}); }
});
