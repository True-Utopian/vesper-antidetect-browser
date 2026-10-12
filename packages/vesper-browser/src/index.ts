export { VesperBrowser } from './browser.js';
export { browserAccessToken, createBrowserServer } from './server.js';
export { VesperBrowserClient } from './client.js';
export type { VesperBrowserClientOptions } from './client.js';
export type {
  LocalEngineOptions as VesperBrowserOptions,
  LocalProfileSettings as ProfileSettings,
  LocalProfile as Profile,
  // Compatibility names retain existing Workbench embeddings.
  LocalEngineOptions, LocalProfileSettings, LocalProfile,
} from './browser.js';
export type { ProfileEngine, ProxyChoice } from './types.js';
export type { SavedProxy } from './proxies.js';
export { AdmissionJournal, leaseKey } from './contract.js';
export { acquireProcessLock } from './process-lock.js';
export { environmentCapabilities, validateEnvironment } from './persona.js';
export type { EnvironmentPolicy } from './persona.js';
export { fingerprintCapabilities, validateFingerprint } from './native-preferences.js';
export type { FingerprintPolicy } from './native-preferences.js';
export type { TargetPolicyReport } from './target-policy.js';
export type { EngineCanaryReport } from './engine-canary.js';
export type { EngineFamily, NativeKernelReport, NativeRuntimeFile } from './native-kernel.js';
export { qualifyNativeKernel } from './native-qualification.mjs';

export type { BrowserExtension } from './extensions.js';
