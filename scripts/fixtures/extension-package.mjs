import { crc32 } from 'node:zlib';

/** Small, original ZIP fixtures; no network and no external extension dependencies. */
export function extensionZip(version = '1.0.0') {
  return zipFiles({
    'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Vesper local qualification', version,
      description: 'Owned loopback-only extension fixture by true-utopian.', permissions: ['storage'],
      background: { service_worker: 'background.js' },
      content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'], run_at: 'document_end' }] }),
    'background.js': `const first={cpu:navigator.hardwareConcurrency,language:navigator.language};
chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(message.kind!=='vesper-fixture')return;
chrome.storage.local.get({visits:0}).then(async data=>{const visits=data.visits+1;await chrome.storage.local.set({visits});respond({visits,first,version:chrome.runtime.getManifest().version});});return true;});`,
    'content.js': `chrome.runtime.sendMessage({kind:'vesper-fixture'},result=>{
if(chrome.runtime.lastError){document.documentElement.dataset.vesperExtensionError=chrome.runtime.lastError.message;return;}
document.documentElement.dataset.vesperExtension=JSON.stringify({...result,content:{cpu:navigator.hardwareConcurrency,language:navigator.language}});});`,
    'Cache/owned-resource.txt': 'An extension resource must survive profile cache exclusion.',
  });
}
export function zipFiles(entries) {
  const localParts = [], centralParts = []; let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const filename = Buffer.from(name), body = Buffer.from(data), crc = crc32(body);
    const local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt32LE(crc,14);
    local.writeUInt32LE(body.length,18); local.writeUInt32LE(body.length,22); local.writeUInt16LE(filename.length,26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x314,4); central.writeUInt16LE(20,6);
    central.writeUInt32LE(crc,16); central.writeUInt32LE(body.length,20); central.writeUInt32LE(body.length,24);
    central.writeUInt16LE(filename.length,28); central.writeUInt32LE((0o100644<<16)>>>0,38); central.writeUInt32LE(offset,42);
    localParts.push(local,filename,body); centralParts.push(central,filename); offset += local.length+filename.length+body.length;
  }
  const central = Buffer.concat(centralParts), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length,8); end.writeUInt16LE(Object.keys(entries).length,10);
  end.writeUInt32LE(central.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...localParts,central,end]);
}
