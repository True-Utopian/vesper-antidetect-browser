import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { durableWrite } from './storage.js';
import { extractEngineZip } from './zip.js';

export interface BrowserExtension {
  id: string; browserId?: string; name: string; version: string; description: string;
  permissions: string[]; hostPermissions: string[]; files: number; bytes: number;
}
const identifier = /^[a-f0-9]{64}$/;
const limit = 128 * 1024 ** 2;
async function publishDirectory(source: string, destination: string) {
  // Windows indexers can briefly hold a newly extracted file. Keep staging
  // private and retry the atomic publish, rather than exposing partial files.
  for(let attempt=0;;attempt++){
    try{await rename(source,destination);return;}
    catch(error){if(process.platform!=='win32'||attempt>=5||!['EPERM','EBUSY','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;await new Promise(done=>setTimeout(done,50*2**attempt));}
  }
}
export function validateExtensionIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(id => typeof id !== 'string' || !identifier.test(id)) || new Set(value).size !== value.length) throw new Error('Assign up to 20 unique local extension package IDs');
  return [...value];
}
async function inspect(directory: string): Promise<BrowserExtension> {
  const hash = createHash('sha256'); let files = 0, bytes = 0;
  async function walk(folder: string, prefix = '') {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = prefix + entry.name, path = join(folder, entry.name);
      if (entry.isSymbolicLink() || !entry.isDirectory() && !entry.isFile()) throw new Error('Extension packages cannot contain links or special files');
      if (entry.isDirectory()) { if (name.split('/').length > 32) throw new Error('Extension directory nesting exceeds the limit'); await walk(path, name + '/'); continue; }
      const info = await stat(path); bytes += info.size;
      if (++files > 10000 || bytes > limit) throw new Error('Extension package exceeds its file or size limit');
      hash.update(name + '\0' + info.size + '\0');
      for await (const chunk of createReadStream(path)) hash.update(chunk);
    }
  }
  const manifestFile = join(directory,'manifest.json');
  if ((await stat(manifestFile)).size > 1024 ** 2) throw new Error('Extension manifest exceeds 1 MiB');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.manifest_version !== 3 || typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 200 || typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version) || manifest.version.split('.').some((part: string) => Number(part) > 65535)) throw new Error('Supply an unpacked Manifest V3 extension with a valid name and version');
  const strings = (value: unknown): string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 200 || value.some(item => typeof item !== 'string' || item.length > 2048)) throw new Error('Invalid extension permission list');
    return value;
  };
  const permissions = [...new Set([...strings(manifest.permissions), ...strings(manifest.optional_permissions)])];
  let browserId: string | undefined;
  if (manifest.key !== undefined) {
    if(typeof manifest.key!=='string' || manifest.key.length>16384 || !/^[A-Za-z0-9+/=\s]+$/.test(manifest.key))throw new Error('Invalid extension public key');
    const key=Buffer.from(manifest.key,'base64');createPublicKey({key,format:'der',type:'spki'});
    browserId=createHash('sha256').update(key).digest('hex').slice(0,32).replace(/[0-9a-f]/g,value=>String.fromCharCode(97+parseInt(value,16)));
  }
  if (manifest.content_scripts !== undefined && (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length > 200)) throw new Error('Invalid extension content script list');
  const hostPermissions = [...new Set([...strings(manifest.host_permissions), ...strings(manifest.optional_host_permissions), ...(manifest.content_scripts ?? []).flatMap((script: { matches?: unknown }) => strings(script.matches))])];
  await walk(directory);
  return { id: hash.digest('hex'), ...(browserId?{browserId}:{}), name: manifest.name, version: manifest.version, description: typeof manifest.description === 'string' ? manifest.description.slice(0,4000) : '', permissions, hostPermissions, files, bytes };
}

/** Immutable local packages; each profile retains its own archive-portable copy. */
export class ExtensionStore {
  constructor(private directory: string) {}
  async validateLaunchCopies(paths: string[], records: BrowserExtension[]) {
    if (paths.length !== records.length) throw new Error('Extension launch package count changed');
    for (const [index, path] of paths.entries()) if ((await inspect(path)).id !== records[index]?.id) throw new Error('Extension launch copy changed');
  }
  private path(id: string) { if (!identifier.test(id)) throw new Error('Invalid extension package ID'); return join(this.directory,id); }
  async list(): Promise<BrowserExtension[]> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const result: BrowserExtension[] = [];
    for (const entry of await readdir(this.directory)) if (identifier.test(entry)) result.push(await this.read(entry));
    return result.sort((a,b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  }
  async read(id: string): Promise<BrowserExtension> {
    const record = await inspect(join(this.path(id),'package'));
    if (record.id !== id) throw new Error('Extension package changed; import a fresh version');
    return record;
  }
  async remove(id: string): Promise<void> {
    const destination = this.path(id), root = resolve(this.directory);
    if (!resolve(destination).startsWith(root + sep)) throw new Error('Invalid extension catalog directory');
    for (const directory of [this.directory, destination]) {
      const entry = await lstat(directory);
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Extension catalog directories cannot be links or special files');
    }
    // Only this catalog copy is removed. Profile copies and browser storage
    // belong to their profiles and are never included in this operation.
    await rm(destination, { recursive: true });
  }
  async describe(browserDirectory: string, ids: string[]) {
    const records: BrowserExtension[] = [];
    for (const id of validateExtensionIds(ids)) {
      const local = join(browserDirectory,'.vesper-extensions',id);
      try { await stat(local); const record = await inspect(local); if(record.id!==id)throw new Error('Profile extension package changed'); records.push(record); }
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;records.push(await this.read(id));}
    }
    return records;
  }
  async installZip(file: string) {
    if ((await stat(file)).size > 40 * 1024 ** 2) throw new Error('Extension ZIP exceeds 40 MiB');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const staging = await mkdtemp(join(this.directory,'import-'));
    try {
      const unpacked = join(staging,'package'); await mkdir(unpacked);
      await extractEngineZip(file,unpacked,limit);
      const original = await inspect(unpacked), manifestFile=join(unpacked,'manifest.json');
      const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
      if(manifest.key===undefined){
        // A stable public identity prevents a new unpacked path from losing extension
        // storage on archive import. This is not a CRX signature or a trust claim.
        const seed=Buffer.from(original.id,'hex');
        const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});
        manifest.key=createPublicKey(privateKey).export({format:'der',type:'spki'}).toString('base64');
        await durableWrite(manifestFile,JSON.stringify(manifest));
      }
      const record=await inspect(unpacked), destination = this.path(record.id);
      try { await stat(destination); return await this.read(record.id); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await durableWrite(join(staging,'record.json'),JSON.stringify(record));
      await publishDirectory(staging,destination); return record;
    } finally { await rm(staging,{recursive:true,force:true}); }
  }
  async prepare(browserDirectory: string, ids: string[]): Promise<{ paths: string[]; records: BrowserExtension[] }> {
    const root = join(browserDirectory,'.vesper-extensions'), paths: string[] = [], records: BrowserExtension[] = [];
    for (const id of validateExtensionIds(ids)) {
      const destination = join(root,id), physicalRoot = resolve(root);
      if (!resolve(destination).startsWith(physicalRoot + sep)) throw new Error('Invalid profile extension directory');
      let existing = false;
      try { await stat(destination); existing = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!existing) {
        await this.read(id); await mkdir(root,{recursive:true,mode:0o700});
        const staging = await mkdtemp(join(root,'copy-'));
        try { const copy=join(staging,'package'); await cp(join(this.path(id),'package'),copy,{recursive:true,errorOnExist:true,force:false}); await publishDirectory(copy,destination); }
        finally { await rm(staging,{recursive:true,force:true}); }
      }
      const record = await inspect(destination);
      if (record.id !== id) throw new Error('Profile extension package changed; restore its original archive or assign a fresh package');
      paths.push(destination); records.push(record);
    }
    return { paths, records };
  }
}
