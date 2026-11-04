import {mkdir,cp,readFile,writeFile,stat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {sign} from 'node:crypto';
import * as tar from 'tar';
import {updateKey} from './local-update-signing.mjs';
import contract from '../desktop/plugin-contract.cjs';
import update from '../desktop/update-contract.cjs';
import {stagePluginPayload} from './plugin-staging.mjs';
const root=resolve(import.meta.dirname,'..'),metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const platform=process.argv[2]||process.platform;
if(!['win32','linux'].includes(platform))throw new Error('Build the Workbench desktop payload for Windows or Linux first');
const payloadIndex=process.argv.indexOf('--payload-root');
if(payloadIndex>=0&&(!process.argv[payloadIndex+1]||process.argv[payloadIndex+1].startsWith('--')))throw new Error('Missing --payload-root directory');
const source=payloadIndex<0?join(root,'.desktop-build/workbench',platform,'payload'):resolve(process.argv[payloadIndex+1]),output=join(root,'release/addons');
const payloadMetadata=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
if(payloadMetadata.name!=='@true-utopian/vesper-workbench'||payloadMetadata.version!==metadata.version)throw new Error('Rebuild the Workbench desktop payload for the current version before packaging its add-on');
await stat(join(source,'dist/cli.js'));await stat(join(source,'node_modules/@electric-sql/pglite/package.json'));
// This payload has no browser executable and shares Browser's profile owner.
// Keep platform-native modules out of a package advertised for both platforms.
async function noNative(directory){for(const item of await readdir(directory,{withFileTypes:true})){const file=join(directory,item.name);if(item.isSymbolicLink())throw new Error('Dereference payload dependencies before packing the add-on');if(item.isDirectory())await noNative(file);else if(/\.(node|exe|dll|so|dylib)$/i.test(item.name))throw new Error(`Platform-specific add-on dependency: ${file}`);}}
const stage=await stagePluginPayload({root,source,platform});
await mkdir(join(stage,'runtime'),{recursive:true});
await noNative(join(stage,'payload'));
await cp(join(root,'desktop/service.mjs'),join(stage,'runtime/service.mjs'));
await mkdir(output,{recursive:true});const filename=`Vesper-workbench-${metadata.version}.vplugin.tgz`,file=join(output,filename);
await tar.c({cwd:stage,file,gzip:true,portable:true,noMtime:true},['payload','runtime']);
const payload={schemaVersion:1,id:'workbench',name:'Vesper Workbench',publisher:'true-utopian',version:metadata.version,hostApiVersion:'1.0',platforms:['win32','linux'],arch:'x64',permissions:contract.permissions,filename,bytes:(await stat(file)).size,sha256:await update.hashFile(file)};
const {privateKey,publicKey}=await updateKey();const manifest={...payload,signature:sign(null,Buffer.from(update.canonical(payload)),privateKey).toString('base64')};
await writeFile(file+'.vesper-plugin.json',JSON.stringify(manifest,null,2));
await writeFile(join(root,'desktop/update-public-key.pem'),publicKey);
await contract.verifyPlugin(file+'.vesper-plugin.json',publicKey,{platform,arch:'x64'});
await writeFile(join(output,'SHA256SUMS'),`${payload.sha256}  ${filename}\n${await update.hashFile(file+'.vesper-plugin.json')}  ${filename}.vesper-plugin.json\n`);
console.log(`Signed Workbench add-on by true-utopian: ${file}`);
