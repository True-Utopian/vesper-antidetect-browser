const { app, BrowserWindow, WebContentsView, Menu, dialog, shell, Tray, nativeImage, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const { readFile, mkdir, cp, access } = require('node:fs/promises');
const { forkService } = require('./service-process.cjs');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { verifyLocalUpdate, hashFile } = require('./update-contract.cjs');
const manifest = require('./product.json');
const product = manifest.product;
app.setName(manifest.name);
const dataHome = process.platform === 'linux' ? process.env.XDG_DATA_HOME || join(app.getPath('home'), '.local/share') : app.getPath('appData');
const base = process.env.VESPER_DESKTOP_DATA_DIR || join(dataHome, 'true-utopian', 'vesper');
app.setPath('userData', join(base, `${product}-desktop`));
const payload = app.isPackaged ? join(process.resourcesPath, 'payload') : resolve(__dirname, '..');
let window, tray, quitting = false, workbench, browserOrigin, origin, pendingUpdate, quitOperation, pluginHost;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(start).catch(async error => { await dialog.showMessageBox({ type: 'error', title: manifest.name, message: 'Vesper could not start.', detail: error.message }); quitting = true; app.quit(); });
}
const tokenAt = async file => (await readFile(file, 'utf8')).trim();
const api = async (url, token, path, options = {}) => {
  const response = await fetch(new URL(path, url), { ...options, headers: { authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error(`Service returned HTTP ${response.status}`); return response.json();
};
async function spawnService(kind, env, servicePayload = payload, serviceFile) {
  const service = serviceFile || (app.isPackaged ? join(process.resourcesPath, 'runtime/service.mjs') : join(__dirname, 'service.mjs'));
  const log = join(base, `${kind}.log`);
  const child = await forkService(service, [kind, servicePayload, join(base, kind)], {
    execPath: process.execPath, env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1', VESPER_DESKTOP: 'true' },
    detached: kind === 'browser', log,
  });
  const ready = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`${kind} did not start. See ${log}`)), 120000);
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${kind} stopped during startup (${code}). See ${log}`)); });
    child.once('message', message => { clearTimeout(timer); if (message?.type === 'ready' && Number.isInteger(message.port)) resolveReady(message); else reject(new Error('Invalid service handshake')); });
  });
  if (kind === 'browser') { child.disconnect(); child.unref(); }
  return { child, origin: `http://127.0.0.1:${ready.port}` };
}
async function ensureBrowser() {
  const directory = join(base, 'browser'); await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const descriptor = JSON.parse(await readFile(join(directory, 'service.json'), 'utf8'));
    if (descriptor.version !== 1 || !Number.isInteger(descriptor.pid) || !Number.isInteger(descriptor.port) || descriptor.port < 1 || descriptor.port > 65535) throw new Error('Invalid service descriptor');
    process.kill(descriptor.pid, 0);
    const url = `http://127.0.0.1:${descriptor.port}`;
    const info = await api(url, await tokenAt(join(directory, 'admin-token')), '/api/v1/capabilities');
    if (info.product !== 'Vesper Browser' || info.apiVersion !== '1.0') throw new Error('Incompatible Browser service');
    const expected=JSON.parse(await readFile(join(payload,'packages/vesper-browser/package.json'),'utf8')).version;
    if(info.version!==expected){
      const token=await tokenAt(join(directory,'admin-token')),profiles=await api(url,token,'/api/v1/profiles');
      if(profiles.some(profile=>profile.state==='running'||profile.lease))throw Object.assign(new Error('An older Browser service owns active profiles. Finish its runs and quit that Browser before opening this version.'),{code:'VESPER_UPGRADE_BUSY'});
      await api(url,token,'/api/service/shutdown',{method:'POST'});
      for(let attempt=0;attempt<100;attempt++){try{await access(join(directory,'service.json'));await new Promise(done=>setTimeout(done,100));}catch(error){if(error.code==='ENOENT')break;throw error;}}
      throw new Error('Start the current Browser service');
    }
    return url;
  } catch(error) {if(error.code==='VESPER_UPGRADE_BUSY')throw error;}
  const engine = process.env.VESPER_BROWSER_EXECUTABLE || (app.isPackaged && manifest.bundledBrowser ? join(process.resourcesPath, 'chromium', process.platform === 'win32' ? 'chrome.exe' : 'chrome') : undefined);
  return (await spawnService('browser', { VESPER_BROWSER_EXECUTABLE: engine || '', VESPER_BROWSER_HEADLESS: process.env.VESPER_BROWSER_HEADLESS || 'false' })).origin;
}
async function start() {
  await mkdir(base, { recursive: true, mode: 0o700 });
  await mkdir(join(base,'downloads'),{recursive:true,mode:0o700});
  browserOrigin = await ensureBrowser();
  if (product === 'workbench') {
    const state = join(base, 'workbench'); await mkdir(state, { recursive: true });
    await (await import('./seed-files.mjs')).seedFiles(payload,state);
    workbench = await spawnService('workbench', {
      BROWSER_BACKEND: 'local', HOST: '127.0.0.1', PORT: '0', MAX_CONCURRENCY: '1',
      VESPER_BROWSER_URL: browserOrigin, VESPER_BROWSER_TOKEN_FILE: join(base, 'browser/admin-token'),
      WORKBENCH_DATA_DIR: state, EXPORT_DIR: join(state, 'exports'), AUTOMATIONS_DIR: join(state, 'automations'), FLOWS_DIR: join(state, 'flows'), PROXY_INVENTORY_FILE: join(state, 'proxy-inventory.json'),
      DATABASE_URL: '', WORKBENCH_TOKEN: '', PUBLIC_ORIGIN: '', COOKIE_SECURE: '', KAMELEO_VNC_URL: '',
      VESPER_LOCAL_COORDINATOR: 'true',
      VESPER_SDK_MODULE: require('node:url').pathToFileURL(join(payload, 'dist/index.js')).href,
    });
    origin = workbench.origin;
  } else origin = browserOrigin;
  window = new BrowserWindow({ width: 1380, height: 860, minWidth: 860, minHeight: 560, title: manifest.name, backgroundColor: product === 'browser' ? '#181a1e' : '#edf0f5', icon: join(__dirname, 'icon.png'), webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, preload: join(__dirname,'preload.cjs') } });
  if(product==='browser')pluginHost=require('./workbench-host.cjs').createWorkbenchHost({base,payload,desktop:__dirname,window:()=>window,WebContentsView,dialog,api,tokenAt,spawnService,localDownloads,onService:value=>{workbench=value;}});
  const tokenFile = join(base, product, 'admin-token');
  const token = await tokenAt(tokenFile);
  // Only the local service receives the credential. No token reaches renderer storage, URLs or preload APIs.
  window.webContents.session.webRequest.onBeforeSendHeaders({ urls: [`${origin}/api/*`] }, (details, callback) => {
    if (new URL(details.url).origin === origin) { for(const name of Object.keys(details.requestHeaders))if(name.toLowerCase()==='authorization')delete details.requestHeaders[name];details.requestHeaders.Authorization = `Bearer ${token}`; }
    callback({ requestHeaders: details.requestHeaders });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  localDownloads(window,origin);
  const menu = Menu.buildFromTemplate([
    { label: manifest.name, submenu: [ { label: `About ${manifest.name}`, click: () => dialog.showMessageBox(window, { title: manifest.name, message: `${manifest.name} ${manifest.version}`, detail: 'Open source. By true-utopian.\nLocal profiles and automation.' }) }, { label: 'Show data folder', click: () => shell.openPath(base) }, { type: 'separator' }, { label: 'Quit', click: () => void requestQuit().catch(reportQuitFailure) } ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Vesper', submenu: [{ label: 'Open Browser manager', click: () => { if (product === 'browser') { window.show(); return; } void openBrowserManager(); } }, {label:'Show downloads',click:()=>shell.openPath(join(base,'downloads'))}, { label: 'Install local update', click: () => void chooseLocalUpdate().catch(error => dialog.showMessageBox(window,{type:'error',message:error.message})) }, { label: 'API reference', click: () => shell.openPath(join(payload, 'docs/api.md')) }] },
  ]);
  Menu.setApplicationMenu(menu);
  const image = nativeImage.createFromPath(join(__dirname, 'icon.png'));
  tray = new Tray(image.resize({ width: 20, height: 20 })); tray.setToolTip(`${manifest.name} by true-utopian`);
  tray.setContextMenu(Menu.buildFromTemplate([{ label: `Open ${manifest.name}`, click: () => window.show() }, { label: 'Quit', click: () => void requestQuit().catch(reportQuitFailure) }]));
  tray.on('double-click', () => window.show());
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
  await window.loadURL(origin);
  if(pluginHost&&(await pluginHost.status()).enabled)void pluginHost.resume().catch(error=>dialog.showMessageBox(window,{type:'error',message:'Workbench could not resume.',detail:error.message}));
}
ipcMain.handle('vesper:local-update',async event=>{
  if(event.sender!==window?.webContents || new URL(event.senderFrame.url).origin!==origin) throw new Error('Update request did not come from the local application');
  return chooseLocalUpdate();
});
ipcMain.handle('vesper:browser-manager',async event=>{
  if(pluginHost?.owns(event)){pluginHost.hide();window.webContents.send('vesper:navigate-profiles');return {opened:true};}
  if(event.sender!==window?.webContents || new URL(event.senderFrame.url).origin!==origin) throw new Error('Browser request did not come from the local application');
  await openBrowserManager();return {opened:true};
});
for(const [channel,action] of Object.entries({'plugin-status':()=>pluginHost.status(),'plugin-install':()=>pluginHost.install(),'plugin-enabled':enabled=>pluginHost.enable(enabled),'plugin-open':()=>pluginHost.open(),'plugin-hide':()=>pluginHost.hide(),'plugin-resize':bounds=>pluginHost.resize(bounds)}))ipcMain.handle(`vesper:${channel}`,async(event,value)=>{
  if(!pluginHost||event.sender!==window?.webContents||new URL(event.senderFrame.url).origin!==origin)throw new Error('Add-on request did not come from Vesper Browser');
  return action(value);
});
async function openBrowserManager(){
  const manager=new BrowserWindow({width:1260,height:840,minWidth:680,minHeight:500,title:'Vesper Browser by true-utopian',icon:join(__dirname,'icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:join(__dirname,'preload.cjs'),partition:'vesper-browser-manager'}});
  const token=await tokenAt(join(base,'browser/admin-token'));
  manager.webContents.session.webRequest.onBeforeSendHeaders({urls:[`${browserOrigin}/api/*`]},(details,callback)=>{if(new URL(details.url).origin===browserOrigin){for(const name of Object.keys(details.requestHeaders))if(name.toLowerCase()==='authorization')delete details.requestHeaders[name];details.requestHeaders.Authorization=`Bearer ${token}`;}callback({requestHeaders:details.requestHeaders});});
  manager.webContents.setWindowOpenHandler(()=>({action:'deny'}));manager.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==browserOrigin)event.preventDefault();});manager.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));localDownloads(manager,browserOrigin);await manager.loadURL(browserOrigin);
}
function localDownloads(owner,serviceOrigin){
 const session=owner.webContents.session;
 const listener=(event,item,contents)=>{
  if(contents!==owner.webContents)return;
  if(new URL(item.getURL()).origin!==serviceOrigin){event.preventDefault();return;}
  const filename=item.getFilename().replace(/[^a-z0-9_.-]/gi,'_').slice(0,180)||'vesper-download';
  const destination=join(base,'downloads',randomUUID()+'-'+filename);item.setSavePath(destination);
  item.once('done',(_event,state)=>{if(!owner.isDestroyed())owner.webContents.send('vesper:download',{filename,path:destination,state});});
 };
 session.on('will-download',listener);owner.webContents.once('destroyed',()=>session.removeListener('will-download',listener));
}
async function chooseLocalUpdate(){
  if(pendingUpdate) return {pending:true};
  const choice=await dialog.showOpenDialog(window,{title:'Choose a signed Vesper update',properties:['openFile'],filters:[{name:'Vesper update manifest',extensions:['json']}]});if(choice.canceled)return {cancelled:true};
  const update=await verifyLocalUpdate(choice.filePaths[0],await readFile(join(__dirname,'update-public-key.pem'),'utf8'),{product,platform:process.platform,arch:process.arch,version:manifest.version});
  const token=await tokenAt(join(base,'browser/admin-token')),profiles=await api(browserOrigin,token,'/api/v1/profiles');
  if(profiles.some(profile=>profile.state==='running'||profile.lease)) throw new Error('Finish automation runs and stop all profiles before installing an app update.');
  const confirm=await dialog.showMessageBox(window,{type:'question',message:`Install ${manifest.name} ${update.version}?`,detail:'The signature and installer checksum are verified. Vesper will close its services and save a local data backup before opening the installer.',buttons:['Back up and install','Cancel'],defaultId:1,cancelId:1});if(confirm.response!==0)return {cancelled:true};
  const destination=join(base,'updates',randomUUID());await mkdir(destination,{recursive:true,mode:0o700});const file=join(destination,update.filename);await cp(update.file,file);if(await hashFile(file)!==update.sha256)throw new Error('The copied update failed checksum verification');
  pendingUpdate={...update,file,destination};await requestQuit();return {installing:true,version:update.version};
}
async function requestQuit() {
  return quitOperation??=(async()=>{try{return await performQuit();}catch(error){pendingUpdate=undefined;throw error;}finally{quitOperation=undefined;}})();
}
async function performQuit() {
  if (quitting) return;
  let browserShutdown;
  if (product === 'browser') {
    const token = await tokenAt(join(base, 'browser/admin-token'));
    const profiles = await api(browserOrigin, token, '/api/v1/profiles').catch(() => []);
    if (profiles.some(profile => profile.state === 'running' || profile.lease)) {
      const choice = await dialog.showMessageBox(window, { type: 'question', message: 'Browser profiles are in use.', detail: 'Close the manager and leave profiles running, or stop all profiles and quit Browser.', buttons: ['Keep profiles running', 'Stop profiles and quit', 'Cancel'], defaultId: 0, cancelId: 2 });
      if (choice.response === 2) return;
      browserShutdown = choice.response === 1;
    } else browserShutdown = true;
  }
  // Stop admissions/schedules and drain the owned automation service before its Browser owner.
  if(pluginHost)await pluginHost.shutdown();
  if(browserShutdown)await api(browserOrigin,await tokenAt(join(base,'browser/admin-token')),'/api/service/shutdown',{method:'POST'}).catch(error=>{if(pendingUpdate)throw error;});
  if (workbench?.child?.connected) {
    workbench.child.send('shutdown');
    await Promise.race([new Promise(resolveClose => workbench.child.once('exit', resolveClose)), new Promise(resolveClose => setTimeout(resolveClose, 30000))]);
  }
  if(pendingUpdate){
    if(workbench?.child.exitCode===null)throw new Error('Workbench did not finish shutting down. The update has not started.');
    const token=await tokenAt(join(base,'browser/admin-token'));
    const profiles=await api(browserOrigin,token,'/api/v1/profiles').catch(()=>[]);
    if(profiles.some(profile=>profile.state==='running'||profile.lease))throw new Error('A profile became active. The update has not started.');
    await api(browserOrigin,token,'/api/service/shutdown',{method:'POST'}).catch(()=>{});
    for(let attempt=0;attempt<100;attempt++){try{await access(join(base,'browser/service.json'));await new Promise(resolveWait=>setTimeout(resolveWait,100));}catch{break;}}
    try{await access(join(base,'browser/service.json'));throw new Error('Browser did not finish shutting down');}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const kind of ['browser','workbench'])try{await cp(join(base,kind),join(pendingUpdate.destination,kind),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
    if(await hashFile(pendingUpdate.file)!==pendingUpdate.sha256)throw new Error('Update changed after verification');
    if(process.platform==='win32'){const installer=spawn(pendingUpdate.file,[],{detached:true,stdio:'ignore',windowsHide:true});await new Promise((ready,reject)=>{installer.once('spawn',ready);installer.once('error',reject);});installer.unref();}
    else {const error=await shell.openPath(pendingUpdate.file);if(error)throw new Error(error);}
  }
  quitting = true; tray?.destroy(); app.quit();
}
app.on('before-quit', event => { if (!quitting) { event.preventDefault(); void requestQuit().catch(reportQuitFailure); } });
app.on('activate', () => window?.show());

function reportQuitFailure(error){void dialog.showMessageBox(window,{type:'error',message:'Vesper could not finish shutting down.',detail:error.message+' If services have stopped, close and restart Vesper.'});}
