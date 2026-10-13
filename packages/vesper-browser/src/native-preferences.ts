import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { durableWrite } from './storage.js';

/** Explicit native controls; each Vesper surface requires binary qualification. */
export interface FingerprintPolicy {
  protection: 'standard' | 'off';
  webgl?: 'upstream' | 'restricted';
  audio?: 'upstream' | 'seeded';
  fonts?: 'upstream' | 'restricted';
}
export function validateFingerprint(value: unknown): FingerprintPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['protection','webgl','audio','fonts'].includes(key)) ||
      typeof (value as FingerprintPolicy).protection !== 'string' ||
      !['standard', 'off'].includes((value as FingerprintPolicy).protection)) {
    throw new Error('Fingerprint protection must be standard or off');
  }
  const policy=value as FingerprintPolicy;
  for(const [key,modes] of [['webgl',['upstream','restricted']],['audio',['upstream','seeded']],['fonts',['upstream','restricted']]] as const){
    if(policy[key]!==undefined&&!modes.some(mode=>mode===policy[key]))throw new Error(`Invalid native ${key} policy`);
    if(policy.protection==='off'&&policy[key]!==undefined&&policy[key]!=='upstream')throw new Error('Disabled fingerprint protection cannot enable a native surface policy');
  }
  return structuredClone(value) as FingerprintPolicy;
}

type Preferences = Record<string, any>;
function object(parent: Preferences, key: string): Preferences {
  const value = parent[key];
  if (value === undefined) return parent[key] = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid native preference section: ${key}`);
  return value;
}

/** Only call while the profile process is stopped and its lifecycle lock is held. */
export async function prepareNativePreferences(directory: string, settings: {
  engine?: 'chromium' | 'brave' | 'vesper'; locale?: string; fingerprint?: FingerprintPolicy;
}) {
  const file = join(directory, 'Default', 'Preferences');
  let preferences: Preferences;
  try { preferences = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; preferences = {}; }
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw new Error('Invalid native profile preferences');
  // Managed startPages are opened only after policy admission. Native session
  // restoration could run a saved site's scripts before CDP is connected.
  object(preferences, 'session').restore_on_startup = 5;
  if (settings.locale) object(preferences, 'intl').accept_languages = Intl.getCanonicalLocales(settings.locale)[0];
  if (settings.engine === 'brave') {
    // Brave's versioned open-source content-setting registry maps ASK(3) to
    // balanced native farbling and ALLOW(1) to off. Do not change other Shields.
    const profile = object(preferences, 'profile');
    object(profile, 'default_content_setting_values').fingerprintingV2 = settings.fingerprint?.protection === 'off' ? 1 : 3;
    // A managed profile setting must also clear older site overrides for this
    // one surface; otherwise a persisted ALLOW can silently defeat protection.
    delete object(object(profile, 'content_settings'), 'exceptions').fingerprintingV2;
  }
  await durableWrite(file, JSON.stringify(preferences));
}

export const fingerprintCapabilities = {
  implementation: 'engine-dependent-native-policies', customVesperKernel: 'requires-local-build-and-direct-qualification',
  engines: {
    chromium: { protection: ['off'], customNoise: false },
    vesper: { protection: ['standard','off'], customNoise: true, surfaces: ['hardwareConcurrency','deviceMemory','RGBA8-canvas2d'], pendingSurfacePolicies: ['webgl-debug-restriction','offline-audio-seed','local-font-discovery'], surfaceQualification:'Each selected kernel must supply its own passing receipt; pendingSurfacePolicies names the admission requirements, not global missing implementations', availability: 'only-after-local-native-qualification' },
    brave: { protection: ['standard', 'off'], customNoise: false },
  },
  seedControl: 'vesper-persisted-per-profile', arbitraryDevicePersonas: false, guardedCDP: true,
  scope: 'Brave decides site/session protection and compatibility exceptions. Vesper does not promise a stable spoofed identity or detection bypass.',
};
