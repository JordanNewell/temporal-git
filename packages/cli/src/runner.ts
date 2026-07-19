import { BisectEngine, BisectOptions, BisectResult } from './bisect';
import {
  clearLine,
  reportError,
  reportProgress,
  reportResult,
  reportStart,
} from './reporter';

export interface AutomatedRunOptions extends BisectOptions {
  command: string;
  args?: string[];
  noReset?: boolean;
}

export async function runAutomatedBisect(
  engine: BisectEngine,
  options: AutomatedRunOptions
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

  const result = await engine.run({
    command: options.command,
    args: options.args,
    noReset: options.noReset,
    onProgress(chunk) {
      const commitMatch = chunk.match(/running (.+)/);
      if (commitMatch) {
        clearLine();
      }
    },
    async onStep(_commit, step, total) {
      clearLine();
      reportProgress(step, total);
    },
  });

  clearLine();

  const shortHash = await engine.getShortCommit(result.commit);
  reportResult(result, shortHash);

  return result;
}
