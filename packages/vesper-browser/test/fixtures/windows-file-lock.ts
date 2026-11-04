import { spawn } from 'node:child_process';
import { once } from 'node:events';

/** Owns an OS sharing lock only on a new test file; never an operator file. */
export async function holdWindowsFile(file: string) {
  if (process.platform !== 'win32') throw Error('Windows file sharing fixture requires Windows');
  const script = `$handle=[IO.File]::Open('${file.replaceAll("'", "''")}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None); try { [Console]::Out.WriteLine('owned-lock-ready'); [Console]::Out.Flush(); [Console]::In.ReadLine() | Out-Null } finally { $handle.Dispose() }`;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = once(child, 'exit'); let text = '', errors = '';
  child.stderr.on('data', chunk => errors += chunk);
  try {
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(() => reject(Error('Owned file lock not ready: ' + errors)), 15000);
      const check = (chunk: Buffer) => { text += chunk; if (text.includes('owned-lock-ready')) { clearTimeout(timer); child.stdout.off('data', check); done(); } };
      child.stdout.on('data', check); child.once('error', reject); child.once('exit', () => { clearTimeout(timer); reject(Error('Owned lock exited before ready: ' + errors)); });
    });
  } catch (error) { child.stdin.end('\n'); await exited.catch(() => {}); throw error; }
  let releasing: Promise<void> | undefined;
  return () => releasing ??= (async () => { child.stdin.end('\n'); const [code] = await exited; if (code !== 0) throw Error('Owned file lock failed: ' + errors); })();
}
