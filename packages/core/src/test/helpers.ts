import { spawn } from 'node:child_process';

/**
 * Spawns a command, waits for it to exit, and returns its stdout.
 * Throws on non-zero exit (with stderr included) so test assertions fail
 * loudly on misconfig rather than silently misbehaving.
 */
export function exec(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}`));
    });
  });
}
