import { simpleGit, SimpleGit } from 'simple-git';
import { spawn } from 'child_process';

export interface BisectResult {
  commit: string;
  shortCommit: string;
  author: string;
  date: string;
  message: string;
}

export interface BisectOptions {
  good: string | string[];
  bad: string;
  paths?: string[];
  /** Pass --no-checkout to git bisect start (worktrees-only optimization). */
  noCheckout?: boolean;
}

export interface RunOptions {
  /** Test command argv, e.g. ['npm', 'test']. Length >= 1. */
  command: string[];
  cwd?: string;
  noReset?: boolean;
  onOutput?: (chunk: string) => void;
  /**
   * Fired when git reports a new bisect step.
   * `step` is 1-based and incremented each time git emits a Bisecting line
   * (never derived from the "revisions left" count, which can exceed the
   * step estimate and produce negative progress).
   */
  onStep?: (step: number, totalEstimate: number) => void;
}

const FIRST_BAD_COMMIT_REGEX = /^([0-9a-f]+) is the first bad commit$/m;
const BISECT_STEP_REGEX =
  /Bisecting:\s+(\d+)\s+revisions left to test after this \(roughly (\d+) steps?\)/;

/**
 * Pure stateful reducer for bisect step progress.
 *
 * Git emits lines like:
 *   "Bisecting: 5 revisions left to test after this (roughly 3 steps)"
 *
 * The "revisions left" count can EXCEED the "roughly N steps" estimate early
 * in the search (git reports the full remaining set, not steps remaining).
 * Naively computing `total - left + 1` produces negative progress. This
 * reducer instead counts observed Bisecting lines and refines the estimate
 * upwards as the search narrows.
 *
 * Exported for unit testing without spawning git.
 */
export interface BisectStepState {
  step: number;
  totalEstimate: number;
}

export function reduceBisectStep(
  prev: BisectStepState,
  chunk: string
): BisectStepState {
  const m = chunk.match(BISECT_STEP_REGEX);
  if (!m) return prev;
  const left = parseInt(m[1]) || 0;
  const reportedTotal = parseInt(m[2]) || 1;
  const step = prev.step + 1;
  const totalEstimate =
    prev.totalEstimate === 0
      ? reportedTotal
      : Math.max(prev.totalEstimate, step + left);
  return { step, totalEstimate };
}

/**
 * Wraps `git bisect` with typed helpers. Used by both the CLI and the
 * VS Code extension so behavior can't drift between them.
 */
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

  async isActive(): Promise<boolean> {
    try {
      await this.git.raw(['bisect', 'log']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reports whether we are inside a git work tree. `isActive()` returns false
   * both when not in a repo and when no bisect is running — use this first
   * if you need to distinguish the two.
   */
  async isInsideRepo(): Promise<boolean> {
    try {
      const out = await this.git.raw(['rev-parse', '--is-inside-work-tree']);
      return out.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Runs `git bisect run <command...>`. `command` is an argv array so the
   * caller's intent is preserved — `['npm', 'test']` reaches git as two
   * separate argv words, never a single mangled string.
   *
   * Implementation note: `git bisect run` passes its args straight to the
   * shell/git-exec machinery. Passing argv directly (rather than joining
   * into one shell-quoted string) avoids a Windows/msys2 quirk where the
   * joined form is exec'd as a literal command name and fails with
   * "command not found".
   */
  run(options: RunOptions): Promise<BisectResult> {
    if (!options.command || options.command.length === 0) {
      return Promise.reject(
        new Error('run() requires a non-empty command argv array')
      );
    }

    return new Promise((resolve, reject) => {
      const gitArgs = ['bisect', 'run', ...options.command];
      const proc = spawn('git', gitArgs, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stepState: BisectStepState = { step: 0, totalEstimate: 0 };

      const handleChunk = (chunk: string): void => {
        stdout += chunk;
        options.onOutput?.(chunk);

        const next = reduceBisectStep(stepState, chunk);
        if (next !== stepState) {
          stepState = next;
          options.onStep?.(stepState.step, stepState.totalEstimate);
        }
      };

      proc.stdout.on('data', (data: Buffer) => handleChunk(data.toString()));
      proc.stderr.on('data', (data: Buffer) => {
        const s = data.toString();
        stderr += s;
        options.onOutput?.(s);
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
            reject(
              new Error(`Found commit ${hash} but failed to get details: ${err}`)
            );
          }
        } else if (code !== 0) {
          reject(new Error(`Bisect failed (exit ${code}): ${stderr || stdout}`));
        } else {
          reject(
            new Error('Bisect completed without finding the first bad commit')
          );
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git bisect: ${err.message}`));
      });
    });
  }

  async getCommitInfo(hash: string): Promise<BisectResult> {
    const short = (
      await this.git.raw(['rev-parse', '--short', hash])
    ).trim();
    const show = await this.git.show([
      '--format=%H%n%an%n%aI%n%B',
      '--no-patch',
      hash,
    ]);
    const lines = show.trim().split('\n');
    return {
      commit: lines[0],
      shortCommit: short,
      author: lines[1],
      date: lines[2],
      message: lines.slice(3).join('\n').trim(),
    };
  }

  async getCurrentCommit(): Promise<{
    hash: string;
    shortHash: string;
    message: string;
    author: string;
  }> {
    const hash = (await this.git.raw(['rev-parse', 'HEAD'])).trim();
    const short = (
      await this.git.raw(['rev-parse', '--short', hash])
    ).trim();
    const show = await this.git.show(['--format=%s%n%an', '--no-patch', hash]);
    const showLines = show.trim().split('\n');
    return {
      hash,
      shortHash: short,
      message: showLines[0],
      author: showLines[1] || '',
    };
  }

  /**
   * Parses the first remote URL for the repo and returns 'owner/repo' if it
   * points at GitHub, or null otherwise. Used by the VS Code extension to
   * decide whether to render the "Open in GitHub" button.
   */
  async getGitHubRemote(): Promise<string | null> {
    try {
      const raw = (await this.git.raw(['config', '--get', 'remote.origin.url'])).trim();
      if (!raw) return null;
      return parseGitHubOwnerRepo(raw);
    } catch {
      return null;
    }
  }
}

/**
 * Accepts the common forms of GitHub remote URL and returns 'owner/repo'.
 * Returns null for non-GitHub URLs or anything we can't parse confidently.
 */
export function parseGitHubOwnerRepo(remoteUrl: string): string | null {
  // SSH: git@github.com:owner/repo.git
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;

  // HTTPS: https://github.com/owner/repo(.git)?
  const https = remoteUrl.match(
    /^https?:\/\/(?:[^@]+@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?$/
  );
  if (https) return `${https[1]}/${https[2]}`;

  return null;
}

/**
 * Single-quotes a string for safe inclusion in a `sh -c` command line.
 * Git bisect run joins args with spaces and execs via `sh -c`, so embedded
 * spaces / quotes must be escaped — otherwise `npm test --grep "foo bar"`
 * would split into separate args.
 *
 * Exported for unit testing.
 */
export function shellQuote(s: string): string {
  // Replace every single-quote with '\'' (close-quote, escaped quote,
  // reopen-quote) — the standard POSIX shell idiom.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
