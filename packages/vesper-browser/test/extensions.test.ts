import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { extensionZip, zipFiles } from '../../../scripts/fixtures/extension-package.mjs';
import { VesperBrowser, VesperBrowserClient, browserAccessToken, createBrowserServer } from '../src/index.js';
import { ExtensionStore } from '../src/extensions.js';

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
    assert.equal((await fetch(url+'/api/v1/extensions/'+installed.id,{method:'DELETE'})).status,401);
    assert.deepEqual(await client.removeExtension(installed.id),{id:installed.id,removed:true});
    assert.deepEqual(await client.extensions(),[]);
    await assert.rejects(client.removeExtension(installed.id),error=>(error as any).status===404);
    await assert.rejects(client.removeExtension('../profiles'),/Invalid extension/);
  } finally { await client.close();await new Promise<void>(done=>server.close(()=>done()));await browser.close();await rm(root,{recursive:true,force:true}); }
});

test('catalog removal protects assigned and trashed profiles, preserves copies and serializes assignment races', async () => {
  const root=await mkdtemp(join(tmpdir(),'vesper-extension-removal-'));
  const browser=new VesperBrowser({directory:root});
  try{
    const file=join(root,'extension.zip');await writeFile(file,extensionZip());
    const installed=await browser.installExtension(file);
    const created=browser.create({extensions:[installed.id]});
    const blocked=assert.rejects(browser.removeExtension(installed.id),error=>(error as any).status===409);
    const profile=await created;await blocked;
    const manifest=join(root,'profiles',profile.id,'manifest.json'),before=await readFile(manifest);
    await assert.rejects(browser.removeExtension('../profiles'));
    assert.deepEqual(await readFile(manifest),before);
    await browser.trash(profile.id);
    await assert.rejects(browser.removeExtension(installed.id),error=>(error as any).status===409);
    await browser.update(profile.id,{extensions:[]});
    const storage=join(root,'profiles',profile.id,'browser','owned-extension-storage.json');
    await writeFile(storage,'{"visits":7}');
    await browser.removeExtension(installed.id);
    assert.deepEqual(await browser.extensions(),[]);
    assert.equal(await readFile(storage,'utf8'),'{"visits":7}');
    await browser.update(profile.id,{extensions:[installed.id]});
    assert.deepEqual(await browser.profileExtensions(profile.id),[installed]);
    assert.deepEqual(await browser.installExtension(file),installed);
    await browser.update(profile.id,{extensions:[]});
    // Deletion winning the queue must reject a new assignment needing a copy.
    const empty=await browser.create({});
    const removed=browser.removeExtension(installed.id);
    const rejected=assert.rejects(browser.update(empty.id,{extensions:[installed.id]}),/ENOENT/);
    await removed;await rejected;
    assert.deepEqual((await browser.readProfile(empty.id)).settings.extensions,undefined);
    // Re-import, then assignment winning the queue must block removal.
    await browser.installExtension(file);
    const assigned=browser.update(empty.id,{extensions:[installed.id]});
    const refused=assert.rejects(browser.removeExtension(installed.id),error=>(error as any).status===409);
    await assigned;await refused;
    assert.deepEqual(await browser.profileExtensions(empty.id),[installed]);
  }finally{await browser.close();await rm(root,{recursive:true,force:true});}
});

test('catalog removal refuses linked directories and cannot delete outside its catalog', async () => {
  const root=await mkdtemp(join(tmpdir(),'vesper-extension-links-'));
  try{
    const outside=join(root,'outside'),catalog=join(root,'catalog'),id='a'.repeat(64);
    await mkdir(outside);await mkdir(catalog);await writeFile(join(outside,'keep'),'untouched');
    await symlink(outside,join(catalog,id),process.platform==='win32'?'junction':'dir');
    await assert.rejects(new ExtensionStore(catalog).remove(id),/cannot be links/);
    assert.equal(await readFile(join(outside,'keep'),'utf8'),'untouched');
    await assert.rejects(new ExtensionStore(catalog).remove('../outside'),/Invalid/);
  }finally{await rm(root,{recursive:true,force:true});}
});
