import * as readline from 'readline';
import { BisectEngine, BisectOptions, BisectResult } from '@temporal-git/core';
import { reportError, reportResult, reportStart, reportStatus } from './reporter';

const FIRST_BAD_COMMIT_REGEX = /^([0-9a-f]+) is the first bad commit$/m;

/**
 * Maps a user's free-text answer to a bisect mark type, or returns null
 * if the answer doesn't unambiguously map. (Previously any unknown input
 * was silently coerced to 'skip', which corrupted the search.)
 */
function parseAnswer(input: string): 'good' | 'bad' | 'skip' | null {
  const v = input.trim().toLowerCase();
  if (v === 'g' || v === 'good') return 'good';
  if (v === 'b' || v === 'bad') return 'bad';
  if (v === 's' || v === 'skip') return 'skip';
  return null;
}

export async function runInteractiveBisect(
  engine: BisectEngine,
  options: BisectOptions
): Promise<BisectResult> {
  const isAlreadyActive = await engine.isActive();
  if (isAlreadyActive) {
    throw new Error('A bisect session is already active. Run "temporal-git reset" first.');
  }

  reportStart(
    Array.isArray(options.good) ? options.good[0] : options.good,
    options.bad
  );

  await engine.start(options);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<BisectResult>((resolve, reject) => {
    const ask = () => {
      void step(engine, rl, resolve, reject, ask);
    };
    ask();
  });
}

function step(
  engine: BisectEngine,
  rl: readline.Interface,
  resolve: (result: BisectResult) => void,
  reject: (err: Error) => void,
  retry: () => void
): void {
  (async () => {
    try {
      const hash = await engine.getCurrentCommit();
      const info = await engine.getCommitInfo(hash.hash);

      reportStatus(hash.shortHash, info.author, info.message);

      rl.question(
        `  Is this commit (g)ood, (b)ad, or (s)kip? `,
        async (answer) => {
          const parsed = parseAnswer(answer);
          if (!parsed) {
            reportError(
              `Unknown answer "${answer.trim()}". Use g/good, b/bad, or s/skip.`
            );
            retry();
            return;
          }
          try {
            const output = await engine.mark(parsed);

            const firstBadMatch = output.match(FIRST_BAD_COMMIT_REGEX);
            if (firstBadMatch) {
              const culpritHash = firstBadMatch[1];
              const result = await engine.getCommitInfo(culpritHash);
              await engine.reset();
              rl.close();
              reportResult(result, result.shortCommit);
              resolve(result);
            } else {
              step(engine, rl, resolve, reject, retry);
            }
          } catch (err) {
            reportError(`Failed to mark commit: ${err}`);
            rl.close();
            reject(err as Error);
          }
        }
      );
    } catch (err) {
      reportError(`Failed to get current commit: ${err}`);
      rl.close();
      reject(err as Error);
    }
  })();
}
