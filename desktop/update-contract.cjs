const { createHash, verify } = require('node:crypto');
const { readFile, lstat, realpath } = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { dirname, join, basename } = require('node:path');
function canonical(value) { if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'; if (value && typeof value==='object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}'; return JSON.stringify(value); }
function newer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function verifyLocalUpdate(file,publicKey,current){
  const meta=await lstat(file);if(!meta.isFile()||meta.isSymbolicLink()||meta.size>16384)throw new Error('Choose a local update manifest smaller than 16 KiB');
  const value=JSON.parse(await readFile(file,'utf8'));
  const keys=['schemaVersion','product','platform','arch','version','filename','bytes','sha256','signature'];
  if(Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>value[key]===undefined)||value.schemaVersion!==1||value.product!==current.product||value.platform!==current.platform||value.arch!==current.arch||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(value.version)||!newer(value.version,current.version)||typeof value.filename!=='string'||value.filename!==basename(value.filename)||!/^(Vesper-|vesper-)[a-z0-9_.-]+\.(exe|deb)$/.test(value.filename)||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>2*1024**3||!/^[a-f0-9]{64}$/.test(value.sha256)||typeof value.signature!=='string')throw new Error('Update is incompatible, malformed, or not newer than this application');
  if(current.platform==='win32'&&!value.filename.endsWith('.exe')||current.platform==='linux'&&!value.filename.endsWith('.deb'))throw new Error('Incorrect installer format');
  const {signature,...payload}=value;if(!verify(null,Buffer.from(canonical(payload)),publicKey,Buffer.from(signature,'base64')))throw new Error('Update signature is not trusted by this installation');
  const candidate=join(dirname(file),value.filename),info=await lstat(candidate);
  if(!info.isFile()||info.isSymbolicLink()||info.size!==value.bytes||await realpath(dirname(candidate))!==await realpath(dirname(file))||await hashFile(candidate)!==value.sha256)throw new Error('Installer contents do not match the signed update manifest');
  return {...payload,file:candidate};
}
module.exports={canonical,hashFile,verifyLocalUpdate,newer};
