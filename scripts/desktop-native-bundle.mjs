import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {nativeExecutableHash,verifyNativeRuntime} from '../packages/vesper-browser/dist/native-kernel.js';

const cases=['baseline','seed-a','seed-a-restart','seed-b','invalid-fallback','surface-policy-a','surface-policy-a-restart','surface-policy-b','surface-policy-invalid'];
const surfaces=['webgl-debug-restriction','offline-audio-seed','local-font-discovery'];
export async function loadDesktopNativeBundle(manifestPath,{platform,hostPlatform=process.platform,hostArch=process.arch,full,directoryOnly=false,revision,chromiumVersion}){
 assert.ok(['win32','linux'].includes(platform)&&platform===hostPlatform&&hostArch==='x64'&&full&&!directoryOnly,'Bundled native qualification requires a full x64 installer on its matching host platform');
 const path=await realpath(manifestPath),record=JSON.parse(await readFile(path,'utf8'));
 assert.equal(record.schemaVersion,1);assert.equal(record.author,'true-utopian');assert.equal(record.executable,platform==='win32'?'chrome.exe':'chrome');
 assert.equal(record.revision,revision);assert.equal(record.chromiumVersion,chromiumVersion);assert.equal(record.nativeUnitExecutions,26);
 const proof=record.qualification;assert.equal(proof?.state,'passed');assert.equal(proof?.nativeProof,true);assert.equal(proof?.implementation,'native-chromium-patches');assert.equal(proof.executableSha256,record.executableSha256);
 assert.ok(Array.isArray(proof.errors)&&proof.errors.length===0);assert.ok(cases.every(name=>proof.cases?.some(value=>value.name===name)),'All nine native cases must pass before bundling');assert.ok(surfaces.every(policy=>proof.surfacePolicies?.includes(policy)),'Native surface qualification is incomplete');
 const executable=join(dirname(path),record.executable);assert.equal(await nativeExecutableHash(executable),record.executableSha256);await verifyNativeRuntime(executable,record.runtimeFiles);
 return {path,directory:dirname(path),record};
}
