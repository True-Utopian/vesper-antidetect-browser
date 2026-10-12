const { contextBridge, ipcRenderer } = require('electron');
const subscribe=(channel,callback)=>{if(typeof callback!=='function')throw new TypeError('Expected callback');const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('vesperDesktop',Object.freeze({
  hostMode:process.argv.includes('--vesper-host-mode=plugin')?'plugin':'standalone',
  chooseLocalUpdate:()=>ipcRenderer.invoke('vesper:local-update'),openBrowserManager:()=>ipcRenderer.invoke('vesper:browser-manager'),
  pluginStatus:()=>ipcRenderer.invoke('vesper:plugin-status'),installWorkbench:()=>ipcRenderer.invoke('vesper:plugin-install'),
  setWorkbenchEnabled:enabled=>ipcRenderer.invoke('vesper:plugin-enabled',enabled),openWorkbench:()=>ipcRenderer.invoke('vesper:plugin-open'),
  hideWorkbench:()=>ipcRenderer.invoke('vesper:plugin-hide'),resizeWorkbench:bounds=>ipcRenderer.invoke('vesper:plugin-resize',bounds),
  onNavigateProfiles:callback=>subscribe('vesper:navigate-profiles',callback),onDownload:callback=>subscribe('vesper:download',callback),
}));
