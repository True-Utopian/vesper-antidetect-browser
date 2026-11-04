import {readFile,mkdir,copyFile,readdir,access,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.includes('--capture-status')){
 assert.ok(!process.argv.includes('--check'),'Capture and check are separate operations');
 const {release}=JSON.parse(await readFile(join(root,'docs/handbook.json'),'utf8'));
 const releaseId=`${release.browser}-${release.workbench}`;assert.match(releaseId,/^\d+\.\d+\.\d+-\d+\.\d+\.\d+$/);
 const directory=join(root,'docs/releases',releaseId);await mkdir(directory,{recursive:true});
 const inventory=JSON.parse(await readFile(join(root,'docs/status.json'),'utf8')),svg=await readFile(join(root,'docs/assets/status.svg'));
 assert.equal(inventory.groups.flatMap(group=>group.checks).length,106);
 await copyFile(join(root,'docs/assets/status.svg'),join(directory,'status.svg'),constants.COPYFILE_EXCL);
 await writeFile(join(directory,'status-snapshot.json'),JSON.stringify({schemaVersion:1,release:{browser:release.browser,workbench:release.workbench},capturedAt:new Date().toISOString(),capturedFrom:['docs/status.json','docs/assets/status.svg'],svgSha256:createHash('sha256').update(svg).digest('hex'),inventory},null,2)+'\n',{flag:'wx'});
}
const output=join(root,'.workbench/offline-handbook');
const result=spawnSync(process.execPath,[join(root,'scripts/build-public-docs.mjs'),output,'--offline'],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error(result.stderr||'Handbook generation failed');
let publicRoot=join(root,'packages/vesper-browser/public/docs');try{await access(publicRoot);}catch{publicRoot=join(root,'public/docs');}
const target=join(publicRoot,'handbook');await mkdir(target,{recursive:true});
const files=['index.html','status.html','downloads.html','LICENSE.txt','site-manifest.json'];
for(const directory of ['assets','wiki']){await mkdir(join(target,directory),{recursive:true});for(const file of await readdir(join(output,directory)))files.push(directory+'/'+file);}
for(const file of files){
 if(process.argv.includes('--check'))assert.deepEqual(await readFile(join(target,file)),await readFile(join(output,file)),`Stale offline handbook: ${file}`);
 else await copyFile(join(output,file),join(target,file));
}
await writePublicManifest();
async function writePublicManifest(){
 const {writeFile}=await import('node:fs/promises');
 const source=JSON.parse(await readFile(join(output,'site-manifest.json'),'utf8'));
 const text=JSON.stringify({schemaVersion:1,release:source.release,files:[...files,'offline-manifest.json'].sort()},null,2)+'\n';
 if(process.argv.includes('--check'))assert.equal(await readFile(join(target,'offline-manifest.json'),'utf8'),text,'Stale offline manifest');
 else await writeFile(join(target,'offline-manifest.json'),text);
}
console.log(JSON.stringify({state:'prepared',target,files:files.length+1}));
