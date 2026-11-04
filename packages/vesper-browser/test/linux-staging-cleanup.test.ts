import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,readdir,stat,symlink,link} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as tar from 'tar';
// @ts-expect-error Build scripts are distributed as JavaScript.
import {createDeb} from '../../../scripts/linux-package.mjs';

test('successive Debian versions omit removed files and release staging after success or failure',async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-deb-upgrade-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'app'),output=join(root,'output');await mkdir(directory);await writeFile(join(directory,'obsolete.txt'),'Previous version only');await writeFile(join(directory,'current.txt'),'Current version');
 await createDeb({directory,output,product:'browser',version:'1.0.0',description:'Owned upgrade fixture'});await rm(join(directory,'obsolete.txt'));
 const file=await createDeb({directory,output,product:'browser',version:'1.0.1',description:'Owned upgrade fixture'}),bytes=await readFile(file);let offset=8,data:Buffer|undefined;
 while(offset<bytes.length){const header=bytes.subarray(offset,offset+60),name=header.subarray(0,16).toString().trim().replace(/\/$/,''),size=Number(header.subarray(48,58).toString());if(name==='data.tar.gz')data=bytes.subarray(offset+60,offset+60+size);offset+=60+size+(size%2);}
 assert.ok(data);const archive=join(root,'data.tar.gz');await writeFile(archive,data);const paths:string[]=[];await tar.t({file:archive,onReadEntry:entry=>paths.push(entry.path)});
 assert.ok(paths.includes('opt/vesper-browser/current.txt'));assert.ok(!paths.includes('opt/vesper-browser/obsolete.txt'));
 assert.deepEqual((await readdir(output)).sort(),['vesper-browser_1.0.0_amd64.deb','vesper-browser_1.0.1_amd64.deb']);
 await assert.rejects(createDeb({directory:join(root,'missing'),output,product:'browser',version:'1.0.2',description:'Owned failure fixture'}));
 assert.deepEqual((await readdir(output)).sort(),['vesper-browser_1.0.0_amd64.deb','vesper-browser_1.0.1_amd64.deb']);
});

test('Debian packaging bounds temporary disk use while retaining data, executable modes and Linux links', {timeout:30000}, async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-deb-space-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'app'),output=join(root,'output');await mkdir(directory);await mkdir(output);
 const bytes=randomBytes(32*1024*1024),expected=createHash('sha256').update(bytes).digest('hex');await writeFile(join(directory,'payload.bin'),bytes);await writeFile(join(directory,'chrome-sandbox'),'Owned sandbox metadata fixture');
 if(process.platform!=='win32')await symlink('payload.bin',join(directory,'alias.bin'));
 async function size(path:string):Promise<number>{let entries;try{entries=await readdir(path,{withFileTypes:true});}catch(error:any){if(error.code==='ENOENT')return 0;throw error;}let total=0;for(const entry of entries){const file=join(path,entry.name);try{if(entry.isDirectory())total+=await size(file);else if(entry.isFile())total+=(await stat(file)).size;}catch(error:any){if(error.code!=='ENOENT')throw error;}}return total;}
 let peak=0,reads=Promise.resolve();const sample=async()=>{peak=Math.max(peak,await size(output));};const timer=setInterval(()=>{reads=reads.then(sample);},5);
 let file:string;try{file=await createDeb({directory,output,product:'browser',version:'2.0.0',description:'Owned space fixture'});}finally{clearInterval(timer);await reads;await sample();}
 assert.ok(peak<bytes.length*2.25+1024*1024,`Temporary package storage exceeded its two-compressed-member budget: ${peak}`);
 const deb=await readFile(file!);let offset=8,data:Buffer|undefined;while(offset<deb.length){const header=deb.subarray(offset,offset+60),name=header.subarray(0,16).toString().trim().replace(/\/$/,''),count=Number(header.subarray(48,58).toString());if(name==='data.tar.gz')data=deb.subarray(offset+60,offset+60+count);offset+=60+count+(count%2);}
 assert.ok(data);const archive=join(root,'inspect-data.tar.gz');await writeFile(archive,data);let observed='',sandboxMode=0,alias='';
 await tar.t({file:archive,onReadEntry:entry=>{if(entry.path==='opt/vesper-browser/payload.bin'){const h=createHash('sha256');entry.on('data',chunk=>h.update(chunk));entry.on('end',()=>{observed=h.digest('hex');});}if(entry.path==='opt/vesper-browser/chrome-sandbox')sandboxMode=entry.mode??0;if(entry.path==='opt/vesper-browser/alias.bin'){assert.equal(entry.type,'SymbolicLink');alias=entry.linkpath;}}});
 assert.equal(observed,expected);assert.equal(sandboxMode&0o7777,0o4755);if(process.platform!=='win32')assert.equal(alias,'payload.bin');
 assert.deepEqual(await readdir(output),['vesper-browser_2.0.0_amd64.deb']);t.diagnostic(JSON.stringify({sourceBytes:bytes.length,peakPackageBytes:peak,archiveBytes:deb.length}));
});

test('large multi-file native payloads complete with hard links inside the install prefix', {timeout:20000}, async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'vesper-deb-components-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'app'),cache=join(root,'compiled-cache'),output=join(root,'output');await mkdir(directory);await mkdir(cache);
 const expected=new Map<string,string>();
 for(let n=0;n<6;n++){const name=`libcomponent-${String(n).padStart(2,'0')}.so`,bytes=randomBytes(20*1024*1024),source=join(cache,name);if(n===0||n===5){await writeFile(source,bytes);await link(source,join(directory,name));}else await writeFile(join(directory,name),bytes);expected.set('opt/vesper-browser/'+name,createHash('sha256').update(bytes).digest('hex'));}
 await link(join(directory,'libcomponent-00.so'),join(directory,'linked-copy.so'));
 const file=await createDeb({directory,output,product:'browser',version:'3.0.0',description:'Owned component fixture'}),deb=await readFile(file);let offset=8,data:Buffer|undefined;
 while(offset<deb.length){const h=deb.subarray(offset,offset+60),name=h.subarray(0,16).toString().trim().replace(/\/$/,''),size=Number(h.subarray(48,58).toString());if(name==='data.tar.gz')data=deb.subarray(offset+60,offset+60+size);offset+=60+size+(size%2);}
 assert.ok(data);const archive=join(root,'inspect.tar.gz');await writeFile(archive,data);const seen=new Map<string,string>();let hardLink='';
 await tar.t({file:archive,strict:true,onReadEntry:entry=>{if(expected.has(entry.path)){assert.equal(entry.type,'File');const hash=createHash('sha256');entry.on('data',chunk=>hash.update(chunk));entry.on('end',()=>seen.set(entry.path,hash.digest('hex')));}if(entry.path==='opt/vesper-browser/linked-copy.so'){assert.equal(entry.type,'Link');hardLink=entry.linkpath;}}});
 assert.deepEqual(seen,expected);assert.equal(hardLink,'opt/vesper-browser/libcomponent-00.so');assert.deepEqual(await readdir(output),['vesper-browser_3.0.0_amd64.deb']);
});
