import { generateKeyPairSync, createPublicKey, sign } from 'node:crypto';
import { mkdir, open, readFile, writeFile, stat } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import contract from '../desktop/update-contract.cjs';
const root=resolve(import.meta.dirname,'..');
export async function updateKey(){
  const directory=join(root,'.workbench','release-signing');await mkdir(directory,{recursive:true,mode:0o700});const file=join(directory,'ed25519-private.pem');
  try{const pair=generateKeyPairSync('ed25519');const handle=await open(file,'wx',0o600);try{await handle.writeFile(pair.privateKey.export({type:'pkcs8',format:'pem'}));await handle.sync();}finally{await handle.close();}}
  catch(error){if(error.code!=='EEXIST')throw error;}
  const privateKey=await readFile(file,'utf8'),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'});return {privateKey,publicKey};
}
export async function signLocalUpdate({file,product,platform,version}){
  const {privateKey}=await updateKey(),payload={schemaVersion:1,product,platform,arch:'x64',version,filename:basename(file),bytes:(await stat(file)).size,sha256:await contract.hashFile(file)};
  const manifest={...payload,signature:sign(null,Buffer.from(contract.canonical(payload)),privateKey).toString('base64')};await writeFile(file+'.vesper-update.json',JSON.stringify(manifest,null,2));return manifest;
}
