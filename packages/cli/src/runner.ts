import { BisectEngine, BisectOptions, BisectResult } from '@temporal-git/core';
import {
  clearLine,
  reportProgress,
  reportResult,
  reportStart,
} from './reporter';

export interface AutomatedRunOptions extends BisectOptions {
  /** Test command argv, e.g. ['npm', 'test']. */
  command: string[];
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
    noReset: options.noReset,
    onOutput(_chunk) {
      // Reserved for richer terminal rendering later.
    },
    onStep(step, total) {
      clearLine();
      reportProgress(step, total);
    },
  });

  clearLine();

  reportResult(result, result.shortCommit);

  return result;
}
