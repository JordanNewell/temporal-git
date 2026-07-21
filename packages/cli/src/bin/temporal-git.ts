#!/usr/bin/env node
// CLI entry. Imported by `bin` so this file owning `program.parse()` is fine —
// it should never be require()'d from elsewhere.

import { Command } from 'commander';
import { BisectEngine, BisectOptions, BisectResult } from '@temporal-git/core';
import { runAutomatedBisect } from '../runner';
import { runInteractiveBisect } from '../interactive';
import { reportError, reportReset } from '../reporter';

// Read from package.json so --version can never drift from the published
// version again. Compiled bin lives at dist/bin/, package.json at the
// package root: ../../package.json.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

const program = new Command();

program
  .name('temporal-git')
  .description('Automated git bisect. Find which commit introduced a bug.')
  .version(pkg.version);

program
  .command('run')
  .description('Run automated bisect with a test command')
  .requiredOption('-g, --good <ref>', 'Good commit (tag, branch, or SHA)')
  .requiredOption('-b, --bad <ref>', 'Bad commit (tag, branch, or SHA)')
  .option('-p, --path <paths...>', 'Limit bisect to specific paths')
  .option('--no-reset', 'Keep bisect refs after finding the culprit')
  .argument('<command>', 'Test command to run on each commit')
  .argument('[args...]', 'Arguments for the test command')
  .action(async (command, args, opts) => {
    const engine = new BisectEngine();
    try {
      await runAutomatedBisect(engine, {
        good: opts.good,
        bad: opts.bad,
        paths: opts.path,
        command: [command, ...args],
        noReset: opts.noReset,
      });
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start an interactive bisect session')
  .requiredOption('-g, --good <ref>', 'Good commit (tag, branch, or SHA)')
  .requiredOption('-b, --bad <ref>', 'Bad commit (tag, branch, or SHA)')
  .option('-p, --path <paths...>', 'Limit bisect to specific paths')
  .action(async (opts) => {
    const engine = new BisectEngine();
    try {
      await runInteractiveBisect(engine, {
        good: opts.good,
        bad: opts.bad,
        paths: opts.path,
      });
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('good [commit]')
  .alias('g')
  .description('Mark current (or specified) commit as good')
  .action(async (commit) => {
    const engine = new BisectEngine();
    try {
      await engine.mark('good', commit);
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('bad [commit]')
  .alias('b')
  .description('Mark current (or specified) commit as bad')
  .action(async (commit) => {
    const engine = new BisectEngine();
    try {
      await engine.mark('bad', commit);
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('skip [commit]')
  .alias('s')
  .description('Skip current (or specified) commit')
  .action(async (commit) => {
    const engine = new BisectEngine();
    try {
      await engine.mark('skip', commit);
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('reset [commit]')
  .alias('r')
  .description('Reset the bisect session and return to original HEAD')
  .action(async (commit) => {
    const engine = new BisectEngine();
    try {
      await engine.reset(commit);
      reportReset();
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('log')
  .description('Show the bisect session log')
  .action(async () => {
    const engine = new BisectEngine();
    try {
      const log = await engine.log();
      console.log(log);
    } catch {
      reportError('No active bisect session.');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current bisect status')
  .action(async () => {
    const engine = new BisectEngine();
    if (!(await engine.isInsideRepo())) {
      reportError('Not inside a git repository.');
      process.exit(1);
    }
    if (!(await engine.isActive())) {
      console.log('  No active bisect session.');
      return;
    }
    try {
      const log = await engine.log();
      console.log(log);
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
