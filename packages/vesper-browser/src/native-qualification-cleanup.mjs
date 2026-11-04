import {win32} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

/** Select only this qualification's disposable Windows browser processes.
 * @param {{pid:number,created:string,executable:string,commandLine?:string}[]} records
 * @param {string} executable
 * @param {string} directory
 * @returns {{pid:number,created:string,executable:string}[]}
 */
export function selectQualificationProcesses(records, executable, directory) {
  const root=win32.normalize(directory).replace(/[\\/]+$/,'');
  if(!win32.isAbsolute(root)||!/^vesper-kernel-proof-[a-z0-9]+$/i.test(win32.basename(root)))return [];
  const expected=win32.normalize(executable).toLowerCase(),prefix=root.toLowerCase()+'\\';
  return records.filter(record=>{
    if(!Number.isSafeInteger(record.pid)||record.pid<1||typeof record.created!=='string'||!record.created)return false;
    if(typeof record.executable!=='string'||win32.normalize(record.executable).toLowerCase()!==expected)return false;
    const flags=[...String(record.commandLine??'').matchAll(/(?:^|\s)--user-data-dir=(?:"([^"]+)"|([^\s]+))/g)];
    if(flags.length!==1)return false;
    const data=win32.normalize(flags[0][1]??flags[0][2]).toLowerCase();
    return data===root.toLowerCase()||data.startsWith(prefix);
  }).map(({pid,created,executable})=>({pid,created,executable}));
}

/** Browser.close can leave orphan crash handlers/renderers on Windows.
 * Qualification stores are freshly generated, disposable fixtures. Recheck
 * executable and creation time before ending only their remaining processes. */
export async function cleanupQualificationProcesses(executable,directory) {
  if(process.platform!=='win32')return {applicable:false,terminated:[]};
  const run=promisify(execFile),options={windowsHide:true,timeout:30000,maxBuffer:8*1024*1024,env:{...process.env,VESPER_PROOF_EXECUTABLE:win32.normalize(executable)}};
  const inspect=`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @((Get-CimInstance Win32_Process -Filter "Name='chrome.exe'") | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.Equals($env:VESPER_PROOF_EXECUTABLE,[StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;executable=$_.ExecutablePath;commandLine=$_.CommandLine;created=$_.CreationDate.ToUniversalTime().ToString('o')} }) | ConvertTo-Json -Depth 3 -Compress`;
  const enumerate=async()=>{const output=(await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',inspect],options)).stdout.trim();if(!output)return [];const value=JSON.parse(output);return Array.isArray(value)?value:[value];};
  const selected=selectQualificationProcesses(await enumerate(),executable,directory);
  if(selected.length){
    const terminate=`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $items=ConvertFrom-Json $env:VESPER_PROOF_PROCESSES; foreach($item in $items){$current=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$item.pid); if($current -and $current.ExecutablePath -and $current.ExecutablePath.Equals($item.executable,[StringComparison]::OrdinalIgnoreCase) -and $current.CreationDate.ToUniversalTime().ToString('o') -eq $item.created){Stop-Process -Id $item.pid -Force -ErrorAction Stop}}`;
    await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',terminate],{...options,env:{...options.env,VESPER_PROOF_PROCESSES:JSON.stringify(selected)}});
  }
  for(let attempt=0;attempt<20;attempt++){
    if(!selectQualificationProcesses(await enumerate(),executable,directory).length)return {applicable:true,terminated:selected.map(record=>record.pid)};
    await new Promise(done=>setTimeout(done,100));
  }
  throw Error('Qualification-owned browser processes did not finish cleanup');
}
