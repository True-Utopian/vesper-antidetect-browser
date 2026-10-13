import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore Local JavaScript release tooling.
import { hashPrivateInventory, validateResumeBackup } from '../../../scripts/upgrade-inventory.mjs';
async function fixture(t: any) {
  const root=await mkdtemp(join(tmpdir(),'vesper-inventory-contract-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const entries=[];
  for(let i=0;i<24;i++){const path=`nested/${i}.bin`,bytes=Buffer.alloc(i*97,i);await mkdir(join(root,'nested'),{recursive:true});await writeFile(join(root,path),bytes);entries.push({path,bytes:bytes.length});}
  return {root,entries};
}
test('bounded private inventory checks every byte, retains order and leaves input unchanged',async t=>{
  const{root,entries}=await fixture(t),before=structuredClone(entries),expected=[];
  for(const entry of entries)expected.push({...entry,sha256:createHash('sha256').update(await readFile(join(root,entry.path))).digest('hex')});
  assert.deepEqual(await hashPrivateInventory(root,entries),expected);assert.deepEqual(entries,before);
});
test('inventory readers obey their bound and all finish before an error returns',async t=>{
  const{root,entries}=await fixture(t);let active=0,maximum=0,reads=0;
  const hashFile=async(file:string)=>{active++;maximum=Math.max(maximum,active);try{await new Promise(done=>setTimeout(done,5));reads++;return createHash('sha256').update(await readFile(file)).digest('hex');}finally{active--;}};
  await hashPrivateInventory(root,entries,{concurrency:3,hashFile});assert.equal(reads,entries.length);assert.equal(maximum,3);assert.equal(active,0);
  const failingHash=async(file:string)=>{active++;try{await new Promise(done=>setTimeout(done,5));if(file.endsWith('0.bin'))throw Error('Owned fixture read failed');return createHash('sha256').update(await readFile(file)).digest('hex');}finally{active--;}};
  await assert.rejects(hashPrivateInventory(root,entries,{concurrency:3,hashFile:failingHash}),/Owned fixture read failed/);assert.equal(active,0);
});
test('inventory rejects traversal, missing files and a file changed during hashing',async t=>{
  const{root,entries}=await fixture(t);
  await assert.rejects(hashPrivateInventory(root,[{path:'../outside',bytes:0}]),/escaped/);
  await assert.rejects(hashPrivateInventory(root,[{path:'missing',bytes:0}]),/ENOENT/);
  const change=async(file:string)=>{await writeFile(file,'changed owned fixture');return createHash('sha256').update(await readFile(file)).digest('hex');};
  await assert.rejects(hashPrivateInventory(root,entries.slice(0,1),{hashFile:change}),/changed during/);
});
test('inventory refuses invalid concurrency and stale file sizes',async t=>{
  const{root,entries}=await fixture(t);
  for(const concurrency of [0,33,1.5])await assert.rejects(hashPrivateInventory(root,entries,{concurrency}),/concurrency/);
  await assert.rejects(hashPrivateInventory(root,[{...entries[0],bytes:2}]),/changed/);
});
test('resume accepts only an interrupted sibling backup and rejects completed or outside copies',async t=>{
  const{root}=await fixture(t),data=join(root,'owned-data'),name='2026-01-01T00-00-00-000Z-11111111-1111-4111-8111-111111111111';
  const backup=join(root,'vesper-upgrade-backups',name);await mkdir(data);await mkdir(join(backup,'data'),{recursive:true});
  assert.equal(await validateResumeBackup(data,backup),backup);
  const outside=join(root,'outside',name);await mkdir(join(outside,'data'),{recursive:true});await assert.rejects(validateResumeBackup(data,outside),/escaped/);
  await writeFile(join(backup,'upgrade-result.json'),'{}');await assert.rejects(validateResumeBackup(data,backup),/applied upgrade/);
});
