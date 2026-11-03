import { generateKeyPairSync, createPublicKey, sign } from 'node:crypto';
import { mkdir, open, readFile, writeFile, stat } from 'node:fs/promises';
import { join, basename, resolve, dirname, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import contract from '../desktop/update-contract.cjs';
const root=resolve(import.meta.dirname,'..');
export async function updateKey({projectRoot=root,environment=process.env,platform=process.platform}={}){
  const legacy=join(projectRoot,'.workbench','release-signing','ed25519-private.pem');
  let file=environment.VESPER_UPDATE_SIGNING_KEY_FILE,external=!!file;
  if(!file){
    let config;try{config=JSON.parse(await readFile(join(projectRoot,'.workbench/release-signing/location.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(config){if(config.schemaVersion!==1||typeof config.privateKeyFile!=='string'||!isAbsolute(config.privateKeyFile))throw Error('Invalid private signing-key location');file=config.privateKeyFile;external=true;}
  }
  if(file&&!isAbsolute(file))throw Error('Choose an absolute private signing-key path');
  if(!file){let existing=false;try{await stat(legacy);existing=true;}catch(error){if(error.code!=='ENOENT')throw error;}file=existing||platform!=='win32'?legacy:join(environment.LOCALAPPDATA||join(homedir(),'AppData/Local'),'true-utopian/vesper-build/signing/ed25519-private.pem');}
  const directory=dirname(file);await mkdir(directory,{recursive:true,mode:0o700});
  // A configured key must already exist. Never silently rotate the trust key
  // when a source checkout moves or an external drive drops its permissions.
  if(external){const privateKey=await readFile(file,'utf8'),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'});return {privateKey,publicKey};}
  try{const pair=generateKeyPairSync('ed25519');const handle=await open(file,'wx',0o600);try{await handle.writeFile(pair.privateKey.export({type:'pkcs8',format:'pem'}));await handle.sync();}finally{await handle.close();}}
  catch(error){if(error.code!=='EEXIST')throw error;}
  const privateKey=await readFile(file,'utf8'),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'});return {privateKey,publicKey};
}
export async function signLocalUpdate({file,product,platform,version}){
  const {privateKey}=await updateKey(),payload={schemaVersion:1,product,platform,arch:'x64',version,filename:basename(file),bytes:(await stat(file)).size,sha256:await contract.hashFile(file)};
  const manifest={...payload,signature:sign(null,Buffer.from(contract.canonical(payload)),privateKey).toString('base64')};await writeFile(file+'.vesper-update.json',JSON.stringify(manifest,null,2));return manifest;
}
