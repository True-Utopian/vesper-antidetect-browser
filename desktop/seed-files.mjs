import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {rename} from 'node:fs/promises';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const legacy={'automations/inspect.mjs':['5d3daa9e2eed32680f4bf78fe5c48802308e793c52bb02256cd67a5358422d75']};
/** Update unchanged examples while retaining user edits and unrelated files. */
export async function seedFiles(payload,state){
 const file=join(state,'starter-files.json');let previous={};
 try{previous=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const next={...previous};
 for(const directory of ['automations','flows']){
  await mkdir(join(state,directory),{recursive:true});
  for(const entry of await readdir(join(payload,directory),{withFileTypes:true})){
   if(!entry.isFile())continue;
   const key=directory+'/'+entry.name,bytes=await readFile(join(payload,key)),sha=digest(bytes),destination=join(state,key);let current;
   try{current=digest(await readFile(destination));}catch(error){if(error.code!=='ENOENT')throw error;}
   if(current===undefined||current===previous[key]||current===sha||legacy[key]?.includes(current)){
    if(current!==sha){const temporary=destination+'.'+randomUUID()+'.tmp';await writeFile(temporary,bytes);await rename(temporary,destination);}
    next[key]=sha;
   }
  }
 }
 const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(next));await rename(temporary,file);
}
