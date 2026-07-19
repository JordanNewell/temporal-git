#!/usr/bin/env node

import { Command } from 'commander';
import { BisectEngine } from './bisect';
import { runAutomatedBisect } from './runner';
import { runInteractiveBisect } from './interactive';
import { reportError, reportReset } from './reporter';

const program = new Command();

program
  .name('temporal-git')
  .description('Automated git bisect. Find which commit introduced a bug.')
  .version('2.0.0');

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
        command,
        args: args.length > 0 ? args : undefined,
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
    } catch (err) {
      reportError('No active bisect session.');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current bisect status')
  .action(async () => {
    const engine = new BisectEngine();
    try {
      const active = await engine.isActive();
      if (!active) {
        console.log('  No active bisect session.');
        return;
      }
      const log = await engine.log();
      const visualize = await engine.visualize();
      console.log(visualize);
    } catch (err) {
      reportError((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
