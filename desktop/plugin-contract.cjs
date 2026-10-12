const { verify } = require('node:crypto');
const { readFile, lstat, realpath, mkdir, rename, access, copyFile, rm } = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { join, dirname, basename, resolve, relative, isAbsolute } = require('node:path');
const { randomUUID } = require('node:crypto');
const { canonical, hashFile } = require('./update-contract.cjs');
const permissions = ['browser.profiles','automation.run','local.storage'];
const maxBytes = 600 * 1024 ** 2;
function validateManifest(value, current) {
  const keys = ['schemaVersion','id','name','publisher','version','hostApiVersion','platforms','arch','permissions','filename','bytes','sha256','signature'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => value[k] === undefined) ||
      value.schemaVersion !== 1 || value.id !== 'workbench' || value.name !== 'Vesper Workbench' || value.publisher !== 'true-utopian' ||
      !/^\d+\.\d+\.\d+$/.test(value.version) || value.hostApiVersion !== '1.0' || value.arch !== current.arch ||
      !Array.isArray(value.platforms) || value.platforms.length !== 2 || !value.platforms.includes('win32') || !value.platforms.includes('linux') || !value.platforms.includes(current.platform) ||
      JSON.stringify(value.permissions) !== JSON.stringify(permissions) || typeof value.filename !== 'string' ||
      value.filename !== `Vesper-workbench-${value.version}.vplugin.tgz` || value.filename !== basename(value.filename) ||
      !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > maxBytes || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      typeof value.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value.signature)) throw new Error('Incompatible or malformed Workbench add-on manifest');
  return value;
}
async function verifyPlugin(file, publicKey, current) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw new Error('Choose a local add-on manifest smaller than 16 KiB');
  const value = validateManifest(JSON.parse(await readFile(file,'utf8')),current);
  const {signature,...payload}=value;
  if(!verify(null,Buffer.from(canonical(payload)),publicKey,Buffer.from(signature,'base64'))) throw new Error('The add-on signature is not trusted by this Browser');
  const archive=join(dirname(file),value.filename), archiveInfo=await lstat(archive);
  if(!archiveInfo.isFile() || archiveInfo.isSymbolicLink() || archiveInfo.size!==value.bytes || await realpath(dirname(archive))!==await realpath(dirname(file)) || await hashFile(archive)!==value.sha256) throw new Error('Add-on contents do not match the signed manifest');
  return {...payload,file:archive};
}
function archivePath(path) {
  const clean=path.replace(/^\.\//,'').replace(/\/$/,'');
  if(!clean || clean.includes('\\') || clean.startsWith('/') || clean.includes(':') || clean.split('/').some(p=>!p || p==='.' || p==='..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))) throw new Error('Unsafe add-on archive path');
  if(!['payload','runtime'].includes(clean.split('/')[0])) throw new Error('Unexpected add-on archive root');
  return clean;
}
async function installPlugin(verified, base, tar) {
  const root=join(base,'plugins/workbench'),directory=join(root,'versions',`${verified.version}-${randomUUID()}`);
  await mkdir(directory,{recursive:true,mode:0o700});
  const archive=join(directory,'package.tgz');await copyFile(verified.file,archive);
  if(await hashFile(archive)!==verified.sha256)throw new Error('Add-on changed before installation');
  // Extract only ordinary files/directories after a complete bounded preflight.
  let count=0,total=0;const seen=new Set();
  await new Promise((done,reject)=>{
    const input=createReadStream(archive),parser=new tar.Parser({strict:true,onReadEntry(entry){
      try{const path=archivePath(entry.path),key=path.toLowerCase();
        if(!['File','Directory'].includes(entry.type) || seen.has(key) || ++count>50000 || !Number.isSafeInteger(entry.size) || entry.size<0 || (total+=entry.size)>maxBytes) throw new Error('Unsafe or oversized add-on archive');
        seen.add(key);entry.resume();
      }catch(error){parser.abort(error);}
    }});
    const fail=error=>{input.destroy();reject(error);};input.once('error',fail);parser.once('error',fail);parser.once('end',done);input.pipe(parser);
  });
  for(const path of ['runtime/service.mjs','payload/dist/cli.js','payload/dist/index.js','payload/public/index.html','payload/package.json']) if(!seen.has(path)) throw new Error(`Add-on is missing ${path}`);
  await tar.x({file:archive,cwd:directory,strict:true,preservePaths:false,noChmod:true,noMtime:true,filter:(_path,entry)=>['File','Directory'].includes(entry.type)});
  await rm(archive);
  const registry={schemaVersion:1,version:verified.version,directory,enabled:true};
  const pending=join(root,`installed-${randomUUID()}.json`);
  await require('node:fs/promises').writeFile(pending,JSON.stringify(registry),{mode:0o600});
  await rename(pending,join(root,'installed.json'));
  return registry;
}
async function readInstalled(base) {
  const root=join(base,'plugins/workbench');let value;
  try{value=JSON.parse(await readFile(join(root,'installed.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw error;}
  const rel=relative(join(root,'versions'),resolve(value.directory||''));
  if(value.schemaVersion!==1 || !/^\d+\.\d+\.\d+$/.test(value.version) || typeof value.enabled!=='boolean' || !rel || rel.startsWith('..') || isAbsolute(rel) || rel.includes('/') || rel.includes('\\')) throw new Error('Invalid installed add-on registry');
  const actual=await realpath(value.directory),versions=await realpath(join(root,'versions'));
  if(dirname(actual)!==versions)throw new Error('Installed add-on directory escapes its store');
  await access(join(actual,'runtime/service.mjs'));await access(join(actual,'payload/dist/cli.js'));
  return {...value,directory:actual};
}
module.exports={permissions,validateManifest,verifyPlugin,archivePath,installPlugin,readInstalled};
