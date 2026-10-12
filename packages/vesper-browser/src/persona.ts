import type { CDPSession } from 'puppeteer-core';

/** Policies enforced by Chromium switches/CDP, without overwriting JS prototypes. */
export interface EnvironmentPolicy {
  hardwareConcurrency?: number;
  deviceMemory?: 2 | 4 | 8 | 16 | 32;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
  screen?: { width: number; height: number; deviceScaleFactor: number };
  webRTC?: 'default' | 'proxy-only';
  webGL?: 'native' | 'disabled';
  images?: 'allow' | 'block';
}
export const environmentCapabilities = {
  implementation: 'chromium-policy-and-cdp', version: 2,
  supported: ['locale','timezone','viewport','screen','hardwareConcurrency','geolocation','webRTC','webGL','images'],
  nativeSurfaces: ['canvas','audio','fonts','mediaDevices','deviceMemory','userAgent','clientHints'],
  maskingEngine: false, allWorkersQualified: false,
  workerPolicies: ['hardwareConcurrency', 'locale', 'timezone'],
  screenScope: { headed: 'top-level-emulation', headless: 'native-virtual-display' },
};
export function validateEnvironment(value: unknown): EnvironmentPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid environment policy');
  const policy = value as EnvironmentPolicy;
  if (Object.keys(policy).some(key => !['hardwareConcurrency','deviceMemory','geolocation','screen','webRTC','webGL','images'].includes(key))) throw new Error('Unsupported environment policy');
  if (policy.hardwareConcurrency !== undefined && (!Number.isInteger(policy.hardwareConcurrency) || policy.hardwareConcurrency < 1 || policy.hardwareConcurrency > 64)) throw new Error('Invalid CPU count');
  if (policy.deviceMemory !== undefined && ![2,4,8,16,32].includes(policy.deviceMemory)) throw new Error('Device memory must be a native desktop bucket: 2, 4, 8, 16 or 32');
  if (policy.webRTC !== undefined && !['default','proxy-only'].includes(policy.webRTC)) throw new Error('Invalid WebRTC policy');
  if (policy.webGL !== undefined && !['native','disabled'].includes(policy.webGL)) throw new Error('Invalid WebGL policy');
  if (policy.images !== undefined && !['allow','block'].includes(policy.images)) throw new Error('Invalid image policy');
  if (policy.geolocation !== undefined) {
    const g = policy.geolocation;
    if (!g || Object.keys(g).some(k => !['latitude','longitude','accuracy'].includes(k)) || !Number.isFinite(g.latitude) || Math.abs(g.latitude) > 90 || !Number.isFinite(g.longitude) || Math.abs(g.longitude) > 180 || !Number.isFinite(g.accuracy) || g.accuracy < 0 || g.accuracy > 100000) throw new Error('Invalid geolocation');
  }
  if (policy.screen !== undefined) {
    const s = policy.screen;
    if (!s || Object.keys(s).some(k => !['width','height','deviceScaleFactor'].includes(k)) || !Number.isInteger(s.width) || s.width < 320 || s.width > 7680 || !Number.isInteger(s.height) || s.height < 200 || s.height > 4320 || !Number.isFinite(s.deviceScaleFactor) || s.deviceScaleFactor < 0.5 || s.deviceScaleFactor > 4) throw new Error('Invalid screen');
  }
  return structuredClone(policy);
}
export function environmentArguments(policy?: EnvironmentPolicy) {
  return [...(policy?.webRTC === 'proxy-only' ? ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--disable-quic'] : []), ...(policy?.webGL === 'disabled' ? ['--disable-webgl','--disable-webgl2'] : []), ...(policy?.images === 'block' ? ['--blink-settings=imagesEnabled=false'] : [])];
}
export async function applyEnvironment(session: Pick<CDPSession, 'send'>, policy?: EnvironmentPolicy, type: 'page' | 'iframe' | 'worker' = 'page', viewport?: { width: number; height: number; deviceScaleFactor?: number }) {
  if (policy?.hardwareConcurrency !== undefined) await session.send('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: policy.hardwareConcurrency });
  if (type !== 'worker' && policy?.geolocation) await session.send('Emulation.setGeolocationOverride', policy.geolocation);
  // Chromium rejects device metrics on OOPIF targets; never swallow that error
  // and imply that an iframe received a synthesized screen.
  if (type === 'page' && policy?.screen) await session.send('Emulation.setDeviceMetricsOverride', { ...policy.screen, ...(viewport ? { width: viewport.width, height: viewport.height } : {}), mobile: false, screenWidth: policy.screen.width, screenHeight: policy.screen.height });
}
