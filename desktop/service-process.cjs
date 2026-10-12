const { fork } = require('node:child_process');
const { open } = require('node:fs/promises');

// Direct file descriptors remain valid in a detached service after the manager
// exits. Parent-owned pipes can otherwise produce EPIPE and lose diagnostics.
async function forkService(file, args, { log, ...options }) {
  const output = await open(log, 'a', 0o600);
  try {
    return fork(file, args, { ...options, windowsHide: true, stdio: ['ignore', output.fd, output.fd, 'ipc'] });
  } finally { await output.close(); }
}
module.exports = { forkService };
