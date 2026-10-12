import yauzl,{type ZipFile,type Entry}from'yauzl';
import{mkdir,chmod}from'node:fs/promises';
import{createWriteStream}from'node:fs';
import{dirname,resolve,sep}from'node:path';
import{pipeline}from'node:stream/promises';
import{Transform,type Readable}from'node:stream';

/** Extract regular engine resources only: never materialize archive symlinks. */
export async function extractEngineZip(file:string,directory:string,maxBytes=3*1024**3){
 const root=resolve(directory),zip=await new Promise<ZipFile>((done,reject)=>yauzl.open(file,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true},(error,value)=>error?reject(error):done(value!)));
 let bytes=0,count=0;const names=new Set<string>();
 try{await new Promise<void>((done,reject)=>{
  let failed=false;const fail=(error:Error)=>{if(!failed){failed=true;zip.close();reject(error);}};zip.once('error',fail);zip.once('end',done);
  zip.on('entry',(entry:Entry)=>{void(async()=>{
   const name=entry.fileName.replace(/\/$/,''),parts=name.split('/'),mode=entry.externalFileAttributes>>>16,type=mode&0o170000;
   if(++count>10000||name.length>1024||parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/[<>:"\\|?*\x00-\x1f]/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||names.has(name.toLowerCase())||type!==0&&type!==0o100000&&type!==0o040000||entry.isEncrypted())throw new Error('Unsafe engine archive entry');
   names.add(name.toLowerCase());const destination=resolve(root,name);if(!destination.startsWith(root+sep))throw new Error('Engine archive path escapes its directory');
   bytes+=entry.uncompressedSize;if(bytes>maxBytes)throw new Error('Engine archive exceeds extraction limits');
   if(entry.fileName.endsWith('/')){await mkdir(destination,{recursive:true});}else{
    await mkdir(dirname(destination),{recursive:true});const source=await new Promise<Readable>((done,reject)=>zip.openReadStream(entry,(error,stream)=>error?reject(error):done(stream!)));let written=0;
    await pipeline(source,new Transform({transform(chunk:Buffer,_encoding,callback){written+=chunk.length;callback(written>entry.uncompressedSize?new Error('Engine entry exceeds its declared size'):null,chunk);}}),createWriteStream(destination,{flags:'wx',mode:0o600}));
    if(written!==entry.uncompressedSize)throw new Error('Engine entry size does not match');
    if(process.platform!=='win32')await chmod(destination,mode&0o111?0o755:0o644);
   }
   if(!failed)zip.readEntry();
  })().catch(fail);});zip.readEntry();
 });}finally{zip.close();}
}
