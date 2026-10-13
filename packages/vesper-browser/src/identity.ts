import type { EnvironmentPolicy } from './persona.js';

/** These are bounded native hardware policies, not invented operating systems or GPUs. */
export type IdentityPreset = 'custom' | 'native' | 'desktop-4' | 'desktop-8';
export const identityPresets = [
  { id: 'custom', title: 'Custom settings', cpu: null, memory: null },
  { id: 'native', title: 'Native hardware', cpu: null, memory: null },
  { id: 'desktop-4', title: '4 threads / 4 GB', cpu: 4, memory: 4 },
  { id: 'desktop-8', title: '8 threads / 8 GB', cpu: 8, memory: 8 },
] as const;

export function identityEnvironment(preset: unknown, engine: unknown, environment?: EnvironmentPolicy): EnvironmentPolicy | undefined {
  if (preset === undefined || preset === 'custom') return environment;
  const selected = identityPresets.find(value => value.id === preset);
  if (!selected) throw new Error('Invalid identity preset');
  if (engine !== 'vesper') throw new Error('Native identity presets require the Vesper kernel');
  if (environment?.screen || environment?.webGL === 'disabled') throw new Error('Native identity presets require native screen metrics and WebGL rendering; choose Custom settings to override them');
  for (const [field, expected] of [['hardwareConcurrency', selected.cpu], ['deviceMemory', selected.memory]] as const) {
    const value = environment?.[field];
    if (value !== undefined && value !== expected) throw new Error(`Identity preset conflicts with ${field}; use its matching value or choose Custom settings`);
  }
  return { ...environment, ...(selected.cpu === null ? {} : { hardwareConcurrency: selected.cpu, deviceMemory: selected.memory! }) };
}

export interface IdentityObservation {
  userAgent: string; platform: string; languages: readonly string[];
  hardwareConcurrency: number; deviceMemory?: number; locale: string; timezone: string;
  screen: { width: number; height: number; pixelRatio: number };
  viewport: { width: number; height: number };
  clientHints?: { platform?: string; brands?: Array<{brand: string; version: string}>; fullVersionList?: Array<{brand: string; version: string}>; platformVersion?: string; architecture?: string; bitness?: string; mobile?: boolean } | null;
}
export function auditIdentity(observed: IdentityObservation, settings: { identityPreset?: IdentityPreset; environment?: EnvironmentPolicy; locale?: string; timezone?: string }, browserVersion: string) {
  const checks: Array<{ id: string; title: string; state: 'passed' | 'mismatch' | 'unavailable'; expected: unknown; observed: unknown }> = [];
  const compare = (id: string, title: string, expected: unknown, actual: unknown) => checks.push({ id, title, state: actual === undefined || actual === null ? 'unavailable' : expected === actual ? 'passed' : 'mismatch', expected, observed: actual ?? null });
  const version = /(?:Chrome|Chromium|HeadlessChrome|Brave)\/(\d+(?:\.\d+){3})/.exec(browserVersion)?.[1];
  const uaMajor = /(?:Chrome|HeadlessChrome)\/(\d+)/.exec(observed.userAgent)?.[1];
  if (version) {
    compare('ua-version', 'User agent matches kernel major version', version.split('.')[0], uaMajor);
    const chromium = observed.clientHints?.fullVersionList?.find(value => value.brand === 'Chromium');
    compare('hint-version', 'Client hints match kernel full version', version, chromium?.version);
  } else checks.push({id:'kernel-version',title:'Kernel version is available',state:'unavailable',expected:'native browser version',observed:browserVersion});
  const platform = observed.platform === 'Win32' ? 'Windows' : observed.platform.startsWith('Linux') ? 'Linux' : observed.platform.startsWith('Mac') ? 'macOS' : undefined;
  if (platform) {
    compare('platform', 'Platform matches client hints', platform, observed.clientHints?.platform);
    const uaPlatform = /Windows NT/.test(observed.userAgent) ? 'Windows' : /Linux/.test(observed.userAgent) ? 'Linux' : /Macintosh/.test(observed.userAgent) ? 'macOS' : undefined;
    compare('ua-platform', 'User agent matches platform', platform, uaPlatform);
  }
  if (settings.environment?.hardwareConcurrency !== undefined) compare('cpu', 'CPU threads match profile', settings.environment.hardwareConcurrency, observed.hardwareConcurrency);
  if (settings.environment?.deviceMemory !== undefined) compare('memory', 'Device memory matches profile', settings.environment.deviceMemory, observed.deviceMemory);
  if (settings.locale) {
    const locale = Intl.getCanonicalLocales(settings.locale)[0];
    compare('language', 'Language matches profile', locale, observed.languages[0]);
    compare('locale', 'Formatting locale matches profile', locale, observed.locale);
  }
  if (settings.timezone) compare('timezone', 'Timezone matches profile', new Intl.DateTimeFormat('en', {timeZone:settings.timezone}).resolvedOptions().timeZone, observed.timezone);
  compare('viewport', 'Window content fits the screen', true, observed.viewport.width <= observed.screen.width && observed.viewport.height <= observed.screen.height);
  return { preset: settings.identityPreset ?? 'custom', state: checks.some(value=>value.state==='mismatch') ? 'mismatch' : checks.some(value=>value.state==='unavailable') ? 'incomplete' : 'passed', checks,
    scope: 'Observed page only. HTTP headers, workers, frames, WebGPU and cross-device impersonation require separate qualification.' };
}
