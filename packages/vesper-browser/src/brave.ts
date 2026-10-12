import { mkdir, readFile, access, rm,rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve,sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {extractEngineZip} from './zip.js';
import { durableWrite } from './storage.js';
export async function installBrave(directory: string, version: string) {
  if (!/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,5}$/.test(version)) throw new Error('Invalid Brave version');
  if (process.arch !== 'x64' || !['win32','linux'].includes(process.platform)) throw new Error('Brave integration currently requires Windows/Linux x64');
  const destination=join(directory,'brave',version),metadata=join(destination,'vesper-engine.json');
  try { const cached=JSON.parse(await readFile(metadata,'utf8'));await access(cached.executablePath);return cached; } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
  const response=await fetch(`https://api.github.com/repos/brave/brave-browser/releases/tags/v${version}`,{headers:{'user-agent':'Vesper-Browser-by-true-utopian'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Official Brave release metadata returned ${response.status}`);
  const release=await response.json() as {assets:Array<{name:string;size:number;digest:string;browser_download_url:string}>};
  const filename=process.platform==='win32'?`brave-v${version}-win32-x64.zip`:`brave-browser-${version}-linux-amd64.zip`,asset=release.assets.find(x=>x.name===filename);
  if(!asset||!/^sha256:[a-f0-9]{64}$/.test(asset.digest)||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>500*1024**2||asset.browser_download_url!==`https://github.com/brave/brave-browser/releases/download/v${version}/${filename}`)throw new Error('Official release lacks a supported archive with a SHA-256 digest');
  const parent=resolve(directory,'brave'),staging=join(parent,'staging-'+randomUUID());await mkdir(staging,{recursive:true});const archive=join(staging,'download.zip'),hash=createHash('sha256');let count=0;
  try {
  const download=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(600000)});if(!download.ok||!download.body)throw new Error('Brave archive download failed');
  const final=new URL(download.url);if(final.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com'].includes(final.hostname))throw new Error('Unexpected Brave download host');
    await pipeline(Readable.fromWeb(download.body as any),new Transform({transform(chunk:Buffer,_encoding,callback){count+=chunk.length;hash.update(chunk);callback(count>asset.size?new Error('Brave archive exceeds its declared size'):null,chunk);}}),createWriteStream(archive,{flags:'wx',mode:0o600}));
    if(count!==asset.size||hash.digest('hex')!==asset.digest.slice(7))throw new Error('Brave archive digest does not match the official release');
    const unpacked=join(staging,'engine');await mkdir(unpacked);await extractEngineZip(archive,unpacked);
    const binary=process.platform==='win32'?'brave.exe':'brave';await access(join(unpacked,binary));await rename(unpacked,destination);
    const executablePath=join(destination,binary);
    const record={family:'brave',buildId:version,executablePath,sha256:asset.digest.slice(7),source:`https://github.com/brave/brave-browser/releases/tag/v${version}`,nativePrivacy:'Brave Shields / native fingerprint protection',stagedAt:new Date().toISOString()};
    await durableWrite(metadata,JSON.stringify(record));return record;
  } finally {if(!resolve(staging).startsWith(parent+sep))throw new Error('Invalid engine staging cleanup path');await rm(staging,{recursive:true,force:true});}
}
