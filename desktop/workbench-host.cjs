const {readFile,mkdir,writeFile,rename}=require('node:fs/promises');
const {join}=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const {verifyPlugin,installPlugin,readInstalled}=require('./plugin-contract.cjs');
function createWorkbenchHost({base,payload,desktop,window,WebContentsView,dialog,api,tokenAt,spawnService,localDownloads,onService}) {
  let service,view,attached=false,starting,operation;
  const status=async()=>{const installed=await readInstalled(base);return {installed:!!installed,enabled:installed?.enabled??false,version:installed?.version??null};};
  const serialize=action=>{if(operation)throw new Error('Another add-on operation is in progress');return operation=action().finally(()=>{operation=undefined;});};
  const active=async()=>{if(!service)return false;const runs=await api(service.origin,await tokenAt(join(base,'workbench/admin-token')),'/api/v1/runs');return runs.some(run=>['queued','starting','running','paused','awaiting_input','saving'].includes(run.state)||run.cleanupRequired);};
  async function stop(){
    if(starting)await starting;
    if(!service)return;
    if(await active())throw new Error('Finish or cancel Workbench runs and complete their cleanup before disabling or closing the add-on.');
    hide();view?.webContents.close();view=undefined;
    if(service.child?.connected){
      const child=service.child;
      const exited=new Promise(resolve=>child.once('exit',resolve));child.send('shutdown');
      let timer;await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workbench has not finished shutting down')),30000);})]).finally(()=>clearTimeout(timer));
    }
    service=undefined;onService(undefined);
  }
  async function install(){return serialize(async()=>{
    const choice=await dialog.showOpenDialog(window(),{title:'Add Vesper Workbench',properties:['openFile'],filters:[{name:'Signed Vesper add-on manifest',extensions:['json']}]});
    if(choice.canceled)return {...await status(),cancelled:true};
    const verified=await verifyPlugin(choice.filePaths[0],await readFile(join(desktop,'update-public-key.pem'),'utf8'),{platform:process.platform,arch:process.arch});
    const previous=await readInstalled(base);
    if(previous&&require('./update-contract.cjs').newer(previous.version,verified.version))throw new Error('Choose this Workbench version or a newer one. Older packages may not read your current data.');
    const answer=await dialog.showMessageBox(window(),{type:'question',message:`Add Vesper Workbench ${verified.version}?`,detail:'By true-utopian. The package signature and checksum are verified. Workbench can manage your local Browser profiles, run automations, and store schedules and run history on this PC. It runs with your desktop account permissions.',buttons:['Install add-on','Cancel'],defaultId:1,cancelId:1});
    if(answer.response!==0)return {...await status(),cancelled:true};
    await stop();
    const tar=await import(pathToFileURL(join(payload,'node_modules/tar/dist/esm/index.js')).href);
    await installPlugin(verified,base,tar);return status();
  });}
  async function enable(enabled){return serialize(async()=>{
    if(typeof enabled!=='boolean')throw new Error('Invalid add-on state');
    const installed=await readInstalled(base);if(!installed)throw new Error('Install Workbench first');
    if(!enabled)await stop();
    const file=join(base,'plugins/workbench/installed.json'),pending=file+'.'+randomUUID();
    await writeFile(pending,JSON.stringify({...installed,enabled}),{mode:0o600});await rename(pending,file);
    if(enabled)await ensureService();return status();
  });}
  async function ensureService(){return starting??=(async()=>{
    if(service)return service;
    const installed=await readInstalled(base);if(!installed?.enabled)throw new Error('Install and enable the Workbench add-on first');
    // A standalone Workbench and the add-on share one local store and owner.
    try{
      const record=JSON.parse(await readFile(join(base,'workbench/service.json'),'utf8'));
      if(record.version!==1||!Number.isInteger(record.pid)||record.pid<1||!Number.isInteger(record.port)||record.port<1||record.port>65535)throw new Error('Invalid service record');
      process.kill(record.pid,0);const origin=`http://127.0.0.1:${record.port}`;
      const cap=await api(origin,await tokenAt(join(base,'workbench/admin-token')),'/api/v1/capabilities');
      if(cap.product!=='Vesper Workbench'||cap.apiVersion!=='1.0'||cap.version!==installed.version)throw new Error('A different Workbench version is running. Close it before opening this add-on.');
      throw new Error('Standalone Workbench is running. Close it before opening the add-on; both use the same local data.');
    }catch(error){
      if(error.message?.startsWith('A different Workbench')||error.message?.startsWith('Standalone Workbench'))throw error;
      const state=join(base,'workbench'),servicePayload=join(installed.directory,'payload');await mkdir(state,{recursive:true,mode:0o700});
      await (await import(pathToFileURL(join(desktop,'seed-files.mjs')).href)).seedFiles(servicePayload,state);
      service=await spawnService('workbench',{
        BROWSER_BACKEND:'local',HOST:'127.0.0.1',PORT:'0',MAX_CONCURRENCY:'1',
        VESPER_BROWSER_URL:await require('node:fs/promises').readFile(join(base,'browser/service.json'),'utf8').then(JSON.parse).then(r=>`http://127.0.0.1:${r.port}`),
        VESPER_BROWSER_TOKEN_FILE:join(base,'browser/admin-token'),WORKBENCH_DATA_DIR:state,
        EXPORT_DIR:join(state,'exports'),AUTOMATIONS_DIR:join(state,'automations'),FLOWS_DIR:join(state,'flows'),PROXY_INVENTORY_FILE:join(state,'proxy-inventory.json'),
        DATABASE_URL:'',WORKBENCH_TOKEN:'',PUBLIC_ORIGIN:'',COOKIE_SECURE:'',KAMELEO_VNC_URL:'',VESPER_LOCAL_COORDINATOR:'true',
        VESPER_SDK_MODULE:pathToFileURL(join(servicePayload,'dist/index.js')).href,
      },servicePayload,join(installed.directory,'runtime/service.mjs'));
      service.child.once('exit',()=>{hide();view?.webContents.close();view=undefined;service=undefined;onService(undefined);});
    }
    onService(service);return service;
  })().finally(()=>{starting=undefined;});}
  async function open(){return serialize(async()=>{
    const current=await ensureService();
    if(!view){
      view=new WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,preload:join(desktop,'preload.cjs'),partition:'vesper-workbench-plugin',additionalArguments:['--vesper-host-mode=plugin']}});
      const contents=view.webContents,token=await tokenAt(join(base,'workbench/admin-token'));
      contents.session.webRequest.onBeforeSendHeaders({urls:[`${current.origin}/api/*`]},(details,callback)=>{
        if(new URL(details.url).origin===current.origin){for(const name of Object.keys(details.requestHeaders))if(name.toLowerCase()==='authorization')delete details.requestHeaders[name];details.requestHeaders.Authorization=`Bearer ${token}`;}callback({requestHeaders:details.requestHeaders});
      });
      contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==current.origin)event.preventDefault();});
      contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
      localDownloads({webContents:contents,isDestroyed:()=>contents.isDestroyed()},current.origin);
      await contents.loadURL(current.origin);
    }
    if(!attached){window().contentView.addChildView(view);attached=true;}
    return {opened:true};
  });}
  function hide(){if(attached&&view&&!window()?.isDestroyed()){window().contentView.removeChildView(view);attached=false;}}
  function resize(bounds){
    if(!view||!attached)return;
    const size=window().getContentBounds();
    if(!bounds||['x','y','width','height'].some(key=>!Number.isFinite(bounds[key])))throw new Error('Invalid Workbench view bounds');
    const zoom=window().webContents.getZoomFactor();
    const x=Math.max(0,Math.min(size.width,Math.round(bounds.x*zoom))),y=Math.max(0,Math.min(size.height,Math.round(bounds.y*zoom)));
    view.setBounds({x,y,width:Math.max(0,Math.min(size.width-x,Math.round(bounds.width*zoom))),height:Math.max(0,Math.min(size.height-y,Math.round(bounds.height*zoom)))});
  }
  function owns(event){try{return event.sender===view?.webContents&&new URL(event.senderFrame.url).origin===service?.origin;}catch{return false;}}
  const shutdown=async()=>{if(operation)await operation;await stop();};
  return {status,install,enable,open,hide,resize,owns,stop,active,shutdown,resume:ensureService};
}
module.exports={createWorkbenchHost};
