import { simpleGit, SimpleGit } from 'simple-git';
import { spawn } from 'child_process';

export interface BisectResult {
  commit: string;
  author: string;
  date: string;
  message: string;
}

export interface BisectOptions {
  good: string | string[];
  bad: string;
  paths?: string[];
  noCheckout?: boolean;
}

export interface RunOptions {
  command: string;
  args?: string[];
  cwd?: string;
  noReset?: boolean;
  onProgress?: (output: string) => void;
  onStep?: (commit: string, step: number, total: number) => void;
}

const FIRST_BAD_COMMIT_REGEX = /^([0-9a-f]+) is the first bad commit$/m;

export class BisectEngine {
  private git: SimpleGit;

  constructor(cwd?: string) {
    this.git = simpleGit(cwd);
  }

  async start(options: BisectOptions): Promise<void> {
    const args: string[] = ['bisect', 'start'];

    if (options.noCheckout) {
      args.push('--no-checkout');
    }

    args.push(options.bad);

    const goods = Array.isArray(options.good) ? options.good : [options.good];
    args.push(...goods);

    if (options.paths && options.paths.length > 0) {
      args.push('--', ...options.paths);
    }

    await this.git.raw(args);
  }

  async mark(type: 'good' | 'bad' | 'skip', commit?: string): Promise<string> {
    const args = ['bisect', type];
    if (commit) {
      args.push(commit);
    }
    return this.git.raw(args);
  }

  async reset(commit?: string): Promise<void> {
    const args = ['bisect', 'reset'];
    if (commit) {
      args.push(commit);
    }
    await this.git.raw(args);
  }

  async log(): Promise<string> {
    return this.git.raw(['bisect', 'log']);
  }

  async visualize(): Promise<string> {
    return this.git.raw(['bisect', 'visualize']);
  }

  async isActive(): Promise<boolean> {
    try {
      await this.git.raw(['bisect', 'log']);
      return true;
    } catch {
      return false;
    }
  }

  async run(options: RunOptions): Promise<BisectResult> {
    return new Promise((resolve, reject) => {
      const fullCommand = options.args
        ? `${options.command} ${options.args.join(' ')}`
        : options.command;

      const args: string[] = ['bisect', 'run', fullCommand];

      const proc = spawn('git', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        options.onProgress?.(chunk);

        const stepMatch = chunk.match(
          /Bisecting:\s+(\d+)\s+revisions left to test after this \(roughly (\d+) steps?\)/
        );
        if (stepMatch) {
          const total = parseInt(stepMatch[2]) || 1;
          const step = total - (parseInt(stepMatch[1]) || 0) + 1;
          options.onStep?.('', Math.min(step, total), total);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', async (code) => {
        const match = stdout.match(FIRST_BAD_COMMIT_REGEX);
        if (match) {
          const hash = match[1];
          try {
            const result = await this.getCommitInfo(hash);
            if (!options.noReset) {
              await this.reset();
            }
            resolve(result);
          } catch (err) {
            reject(new Error(`Found commit ${hash} but failed to get details: ${err}`));
          }
        } else if (code !== 0) {
          reject(new Error(`Bisect failed (exit ${code}): ${stderr || stdout}`));
        } else {
          reject(new Error('Bisect completed without finding the first bad commit'));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git bisect: ${err.message}`));
      });
    });
  }

  async getCommitInfo(hash: string): Promise<BisectResult> {
    const show = await this.git.show(['--format=%H%n%an%n%aI%n%B', '--no-patch', hash]);
    const lines = show.trim().split('\n');
    return {
      commit: lines[0],
      author: lines[1],
      date: lines[2],
      message: lines.slice(3).join('\n').trim(),
    };
  }

  async getCurrentCommit(): Promise<string> {
    const revParse = await this.git.raw(['rev-parse', 'HEAD']);
    return revParse.trim();
  }

  async getShortCommit(hash: string): Promise<string> {
    const revParse = await this.git.raw(['rev-parse', '--short', hash]);
    return revParse.trim();
  }
}
