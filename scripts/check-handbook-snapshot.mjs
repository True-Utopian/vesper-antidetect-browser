import assert from 'node:assert/strict';
import {copyFile,mkdir,mkdtemp,readFile,readdir,realpath,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),base=join(root,'.workbench');await mkdir(base,{recursive:true});
const fixture=await mkdtemp(join(base,'handbook-snapshot-check-'));
const handbook=JSON.parse(await readFile(join(root,'docs/handbook.json'))),release=`${handbook.release.browser}-${handbook.release.workbench}`;
const files=['scripts/build-public-docs.mjs','docs/handbook.json','packages/vesper-browser/public/docs/guides.json','docs/status.json','docs/assets/status.svg','docs/assets/guide-browser-profiles.png','docs/assets/guide-workbench.png','docs/site/site.css','docs/site/site.js','public/vesper-mark.svg','LICENSE',`docs/releases/${release}/status-snapshot.json`,`docs/releases/${release}/status.svg`];
async function build(output,offline){const args=[join(fixture,'scripts/build-public-docs.mjs'),output,...(offline?['--offline']:[])];const result=spawnSync(process.execPath,args,{cwd:fixture,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return JSON.parse(await readFile(join(output,'site-manifest.json')));}
async function inventory(directory,prefix=''){const entries=[];for(const entry of await readdir(join(directory,prefix),{withFileTypes:true})){const name=join(prefix,entry.name);if(entry.isDirectory())entries.push(...await inventory(directory,name));else entries.push([name,createHash('sha256').update(await readFile(join(directory,name))).digest('hex')]);}return entries.sort((a,b)=>a[0].localeCompare(b[0]));}
try{
 for(const file of files){await mkdir(dirname(join(fixture,file)),{recursive:true});await copyFile(join(root,file),join(fixture,file));}
 const before=join(fixture,'before'),after=join(fixture,'after'),live=join(fixture,'live');
 const initial=await build(before,true);
 await assert.rejects(readFile(join(fixture,'docs/wiki/README.md')),{code:'ENOENT'});
 const statusFile=join(fixture,'docs/status.json'),status=JSON.parse(await readFile(statusFile));
 const check=status.groups.flatMap(group=>group.checks).find(check=>check.id==='workbench-user-developer-guides');assert.ok(check);check.state='planned';
 const previousLiveCount=status.groups.flatMap(group=>group.checks).filter(check=>check.state==='verified').length;check.state='verified';
 await writeFile(statusFile,JSON.stringify(status));await writeFile(join(fixture,'docs/assets/status.svg'),(await readFile(join(fixture,'docs/assets/status.svg'),'utf8'))+'\n<!-- Changed live progress artwork in owned fixture. -->\n');
 const retained=await build(after,true);assert.deepEqual(retained,initial);assert.deepEqual(await inventory(after),await inventory(before),'Live promotion rewrote an installed release guide');
 await assert.rejects(readFile(join(fixture,'docs/wiki/README.md')),{code:'ENOENT'});
 const current=await build(live,false);assert.equal(current.counts.verified,previousLiveCount+1);assert.notEqual((await inventory(live)).find(([path])=>path===join('assets','status.svg'))?.[1],(await inventory(before)).find(([path])=>path===join('assets','status.svg'))?.[1]);
 assert.match(await readFile(join(fixture,'docs/wiki/README.md'),'utf8'),/guide walkthrough milestone is verified; match your version to its recorded release evidence/);
 console.log(JSON.stringify({state:'passed',offlineInventory:initial.counts.verified,liveInventory:current.counts.verified,offlineFilesUnchanged:(await inventory(before)).length,publicMarkdownUnaffectedByOfflineGeneration:true}));
}finally{assert.equal(await realpath(fixture),fixture);assert.ok(relative(base,fixture).startsWith('handbook-snapshot-check-'));await rm(fixture,{recursive:true});}
