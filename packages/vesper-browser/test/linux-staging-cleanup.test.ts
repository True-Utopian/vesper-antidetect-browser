import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,readdir} from 'node:fs/promises';
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
