import lockfile from 'proper-lockfile';
import { mkdir } from 'node:fs/promises';

/** Atomic mkdir + renewed filesystem lease serializes stale-owner recovery as well as startup.
 * PID manifests remain the conservative live-process check; a missed heartbeat cannot
 * authorize adopting a store while its recorded process is alive.
 */
export async function acquireProcessLock(directory: string, onLost: (error: Error) => void) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return lockfile.lock(directory, { stale: 10000, update: 2000, retries: { retries: 24, factor: 1, minTimeout: 500, maxTimeout: 500 }, onCompromised: onLost });
}
