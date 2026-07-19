import { simpleGit, SimpleGit } from 'simple-git';
import { spawn } from 'child_process';

export interface BisectResult {
  commit: string;
  shortCommit: string;
  author: string;
  date: string;
  message: string;
}

const FIRST_BAD_COMMIT_REGEX = /^([0-9a-f]+) is the first bad commit$/m;

export class BisectEngine {
  private git: SimpleGit;

  constructor(private cwd: string) {
    this.git = simpleGit(cwd);
  }

  async start(bad: string, good: string | string[], paths?: string[]): Promise<void> {
    const args: string[] = ['bisect', 'start', bad];
    const goods = Array.isArray(good) ? good : [good];
    args.push(...goods);
    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }
    await this.git.raw(args);
  }

  async mark(type: 'good' | 'bad' | 'skip', commit?: string): Promise<string> {
    const args = ['bisect', type];
    if (commit) args.push(commit);
    return this.git.raw(args);
  }

  async reset(commit?: string): Promise<void> {
    const args = ['bisect', 'reset'];
    if (commit) args.push(commit);
    await this.git.raw(args);
  }

  async isActive(): Promise<boolean> {
    try {
      await this.git.raw(['bisect', 'log']);
      return true;
    } catch {
      return false;
    }
  }

  async run(
    command: string,
    onOutput: (line: string) => void,
    onProgress: (step: number, total: number) => void
  ): Promise<BisectResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['bisect', 'run', '--', command], {
        cwd: this.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        onOutput(chunk);

        const stepMatch = chunk.match(
          /Bisecting:\s+(\d+)\s+revisions left to test after this \(roughly (\d+) steps?\)/
        );
        if (stepMatch) {
          onProgress(parseInt(stepMatch[2]) - parseInt(stepMatch[1]) + 1, parseInt(stepMatch[2]));
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        onOutput(data.toString());
      });

      proc.on('close', async (code) => {
        const match = stdout.match(FIRST_BAD_COMMIT_REGEX);
        if (match) {
          try {
            const result = await this.getCommitInfo(match[1]);
            await this.reset();
            resolve(result);
          } catch (err) {
            reject(new Error(`Found commit ${match[1]} but failed to get details: ${err}`));
          }
        } else if (code !== 0) {
          reject(new Error(`Bisect failed (exit ${code}): ${stderr || stdout}`));
        } else {
          reject(new Error('Bisect completed without finding the first bad commit'));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git bisect run: ${err.message}`));
      });
    });
  }

  async getCommitInfo(hash: string): Promise<BisectResult> {
    const short = (await this.git.raw(['rev-parse', '--short', hash])).trim();
    const show = await this.git.show(['--format=%H%n%an%n%aI%n%B', '--no-patch', hash]);
    const lines = show.trim().split('\n');
    return {
      commit: lines[0],
      shortCommit: short,
      author: lines[1],
      date: lines[2],
      message: lines.slice(3).join('\n').trim(),
    };
  }

  async getCurrentCommit(): Promise<{ hash: string; shortHash: string; message: string; author: string }> {
    const hash = (await this.git.raw(['rev-parse', 'HEAD'])).trim();
    const short = (await this.git.raw(['rev-parse', '--short', hash])).trim();
    const show = await this.git.show(['--format=%s%n%an', '--no-patch', hash]);
    const showLines = show.trim().split('\n');
    return { hash, shortHash: short, message: showLines[0], author: showLines[1] || '' };
  }

  async getTags(): Promise<string[]> {
    const tags = await this.git.tags();
    return tags.all.map(t => t);
  }

  async getBranches(): Promise<string[]> {
    const branches = await this.git.branchLocal();
    return Object.keys(branches.branches);
  }
}
