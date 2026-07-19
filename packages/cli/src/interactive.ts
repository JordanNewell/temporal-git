import * as readline from 'readline';
import { BisectEngine, BisectOptions, BisectResult } from './bisect';
import { reportError, reportResult, reportStart, reportStatus } from './reporter';

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
    const prompt = () => {
      askCurrent(engine, rl, resolve, reject);
    };
    prompt();
  });
}

function askCurrent(
  engine: BisectEngine,
  rl: readline.Interface,
  resolve: (result: BisectResult) => void,
  reject: (err: Error) => void
): void {
  (async () => {
    try {
      const hash = await engine.getCurrentCommit();
      const shortHash = await engine.getShortCommit(hash);
      const info = await engine.getCommitInfo(hash);

      reportStatus(shortHash, info.author, info.message);

      rl.question(
        `  Is this commit (g)ood, (b)ad, or (s)kip? `,
        async (answer) => {
          const response = answer.trim().toLowerCase();
          try {
            const output = await engine.mark(
              response === 'g' ? 'good' : response === 'b' ? 'bad' : 'skip'
            );

            const firstBadMatch = output.match(/^([0-9a-f]+) is the first bad commit$/m);
            if (firstBadMatch) {
              const culpritHash = firstBadMatch[1];
              const result = await engine.getCommitInfo(culpritHash);
              const shortResultHash = await engine.getShortCommit(culpritHash);
              await engine.reset();
              rl.close();
              reportResult(result, shortResultHash);
              resolve(result);
            } else {
              askCurrent(engine, rl, resolve, reject);
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
