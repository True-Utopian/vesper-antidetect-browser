import assert from 'node:assert/strict';
import {readFile,readdir,lstat,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=await mkdtemp(join(tmpdir(),'vesper-public-docs-'));
try{
 const built=spawnSync(process.execPath,[join(root,'scripts/build-public-docs.mjs'),output],{encoding:'utf8',windowsHide:true});assert.equal(built.status,0,built.stderr);
 const files=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);assert.equal((await lstat(path)).isSymbolicLink(),false);if(entry.isDirectory())await walk(path);else files.push(path);}}await walk(output);
 const manifest=JSON.parse(await readFile(join(output,'site-manifest.json'),'utf8'));
 assert.equal(manifest.chapters.length,13);assert.equal(manifest.counts.total,106);
 const status=JSON.parse(await readFile(join(root,'docs/status.json'),'utf8'));
 assert.equal(manifest.counts.verified,status.groups.flatMap(g=>g.checks).filter(c=>c.state==='verified').length);
 let checkedLinks=0,htmlPages=0;
 for(const file of files){
  const text=await readFile(file,'utf8');
  for(const pattern of [/C:[/\\]Users[/\\]YaBoy/i,/88\.216\.73\.48/,/-----BEGIN (?:\w+ )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/Authorization: Bearer (?!&lt;|<)[A-Za-z0-9_-]{20,}/])assert.ok(!pattern.test(text),'Private material in public output');
  if(!file.endsWith('.html'))continue;htmlPages++;
  assert.match(text,/<html lang="en">/);assert.match(text,/<main id="main"/);assert.match(text,/<title>[^<]+Vesper<\/title>/);
  const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate page IDs');
  for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){
   const href=match[1];if(href.startsWith('https://')){assert.match(href,/^https:\/\/github\.com\/True-Utopian\//);continue;}
   assert.ok(!/^(?:http:|javascript:|data:|\/\/)/.test(href),'Unexpected active or nonlocal resource');
   const [path,hash]=href.split('#'),target=path?resolve(dirname(file),path):file;
   const rel=relative(output,target);assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Link escapes output');
   assert.ok((await lstat(target)).isFile(),`Missing ${href}`);if(hash)assert.match(await readFile(target,'utf8'),new RegExp(`id="${hash}"`));checkedLinks++;
  }
 }
 assert.equal(htmlPages,34);assert.ok(checkedLinks>800);
 const home=await readFile(join(output,'index.html'),'utf8');assert.match(home,/Illustrative workspace/);assert.match(home,/Public installers are not published yet/);
 const download=await readFile(join(output,'downloads.html'),'utf8');assert.ok(!/<a[^>]*download[=> ]/.test(download));
 console.log(JSON.stringify({state:'passed',htmlPages,chapters:manifest.chapters.length,checkedLocalLinks:checkedLinks,privateMaterialExcluded:true,counts:manifest.counts}));
}finally{const rel=relative(tmpdir(),output);assert.ok(rel.startsWith('vesper-public-docs-')&&!rel.includes('..')&&!isAbsolute(rel));await rm(output,{recursive:true,force:true});}
