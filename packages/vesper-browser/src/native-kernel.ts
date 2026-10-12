import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { durableWrite } from './storage.js';
import type { FingerprintPolicy } from './native-preferences.js';

export type EngineFamily = 'chromium' | 'brave' | 'vesper';
export interface NativeKernelReport {
  schemaVersion: 1; author: string; at: string; completedAt?: string;
  state: 'running' | 'passed' | 'failed'; implementation: 'native-chromium-patches';
  executable: string; executableSha256: string; nativeProof: boolean;
  cases: Array<{ name: string; nativeArgs: string[]; version: string; contexts: Record<string, any>; clientHints?: any }>;
  checks: string[]; errors: string[]; limitations: string[];
  diagnosticStack?: string;
  surfacePolicies?: string[];
}
export function assertNativeSurfacePolicies(report: NativeKernelReport | undefined, policy?: FingerprintPolicy) {
  const required = [policy?.webgl==='restricted'?'webgl-debug-restriction':null,policy?.audio==='seeded'?'offline-audio-seed':null,policy?.fonts==='restricted'?'local-font-discovery':null].filter((value):value is string=>value!==null);
  if(required.some(value=>report?.state!=='passed'||report.nativeProof!==true||!report.surfacePolicies?.includes(value)))throw new Error('Requested native surface policy lacks qualification on the selected kernel');
}
export async function nativeExecutableHash(file: string) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}

export interface NativeRuntimeFile { path: string; sha256: string }
/** Component builds enforce policy in shared libraries, so checking only the launcher is insufficient. */
export async function nativeRuntimeInventory(executable: string): Promise<NativeRuntimeFile[]> {
  const root = dirname(await realpath(executable));
  const files = new Set([basename(executable)]);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ((entry.isFile() || entry.isSymbolicLink()) && /(?:\.(dll|pak|bin)|\.so(?:\.[0-9]+)*)$/i.test(entry.name)) files.add(entry.name);
  }
  try {
    for (const entry of await readdir(join(root, 'locales'), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.pak')) files.add(`locales/${entry.name}`);
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (files.size > 2000) throw new Error('Native kernel runtime inventory exceeds the supported limit');
  const result: NativeRuntimeFile[] = [];
  for (const file of [...files].sort()) {
    const physical = await realpath(join(root, file)), inside = relative(root, physical);
    if (inside.startsWith('..')) throw new Error('Native runtime file resolves outside the kernel directory');
    result.push({ path: file, sha256: await nativeExecutableHash(physical) });
  }
  return result;
}
export async function verifyNativeRuntime(executable: string, inventory: NativeRuntimeFile[]) {
  if (!Array.isArray(inventory) || !inventory.length || JSON.stringify(await nativeRuntimeInventory(executable)) !== JSON.stringify(inventory)) throw new Error('Native kernel runtime changed; stage and qualify the complete build again');
}

/** Stored inside the browser directory so archives retain the same identity. */
export async function nativeProfileArguments(directory: string, settings: {
  environment?: { hardwareConcurrency?: number; deviceMemory?: number };
  fingerprint?: FingerprintPolicy;
}) {
  const args: string[] = [];
  const cpu = settings.environment?.hardwareConcurrency;
  const memory = settings.environment?.deviceMemory;
  if (cpu !== undefined) args.push(`--vesper-hardware-concurrency=${cpu}`);
  if (memory !== undefined) args.push(`--vesper-device-memory=${memory}`);
  if (settings.fingerprint?.protection !== 'off') {
    const file = join(directory, '.vesper-native-policy.json');
    let seed: string, policy: {schemaVersion:1;canvasSeed:string;audioSeed?:string};
    let changed=false;
    try {
      policy = JSON.parse(await readFile(file, 'utf8'));
      if (policy.schemaVersion !== 1 || typeof policy.canvasSeed !== 'string' || !/^[0-9a-f]{16}$/.test(policy.canvasSeed)) throw new Error('Invalid persisted native canvas identity');
      seed = policy.canvasSeed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      seed = randomBytes(8).toString('hex');
      policy={schemaVersion:1,canvasSeed:seed}; changed=true;
    }
    if(settings.fingerprint?.audio==='seeded'){
      if(policy.audioSeed===undefined){policy.audioSeed=randomBytes(8).toString('hex');changed=true;}
      if(typeof policy.audioSeed!=='string'||!/^[0-9a-f]{16}$/.test(policy.audioSeed))throw new Error('Invalid persisted native audio identity');
      args.push(`--vesper-audio-seed=${policy.audioSeed}`);
    }
    if(changed)await durableWrite(file,JSON.stringify(policy));
    args.push(`--vesper-canvas-seed=${seed}`);
    if(settings.fingerprint?.webgl==='restricted')args.push('--vesper-webgl-policy=restricted');
    if(settings.fingerprint?.fonts==='restricted')args.push('--vesper-local-font-policy=restricted');
  }
  return args;
}
