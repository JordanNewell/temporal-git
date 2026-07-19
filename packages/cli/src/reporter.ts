import pc from 'picocolors';
import { BisectResult } from './bisect';

export function reportResult(result: BisectResult, shortHash: string): void {
  const lines = [
    '',
    `${pc.red('!')}  ${pc.bold('Found the culprit commit:')}`,
    '',
    `  ${pc.cyan(shortHash)}  ${pc.bold(result.message.split('\n')[0])}`,
    `  ${pc.dim('Author:')} ${result.author}  ${pc.dim('|')}  ${result.date}`,
    '',
    `  ${pc.dim(result.message.split('\n').slice(1).join('\n  '))}`,
    '',
    `  ${pc.dim('Run:')} ${pc.cyan(`git show ${shortHash}`)}     ${pc.dim('Run:')} ${pc.cyan('temporal-git reset')}`,
    '',
  ];

  console.log(lines.join('\n'));
}

export function reportProgress(step: number, total: number): void {
  const bar = formatBar(step, total);
  const pct = Math.round((step / total) * 100);
  process.stdout.write(`  ${pc.dim('Bisecting')} ${bar} ${pc.dim(`${pct}%`)}`);
  process.stdout.write('\r');
}

export function reportStepCommit(commit: string, author: string, message: string): void {
  process.stdout.write(
    `  ${pc.dim('Testing')} ${pc.cyan(commit)} ${pc.dim(`${author} - ${message.split('\n')[0]}`)}   \n`
  );
}

export function reportStart(good: string, bad: string): void {
  console.log(`\n  ${pc.dim('Bisecting between')} ${pc.green(good)} ${pc.dim('and')} ${pc.red(bad)}\n`);
}

export function reportStatus(commit: string, author: string, message: string): void {
  console.log(`\n  ${pc.yellow('?')}  ${pc.bold('Current commit:')}`);
  console.log(`  ${pc.cyan(commit)}  ${message.split('\n')[0]}`);
  console.log(`  ${pc.dim('Author:')} ${author}\n`);
}

export function reportReset(): void {
  console.log(`\n  ${pc.green('OK')}  ${pc.dim('Bisect session reset.')}\n`);
}

export function reportError(message: string): void {
  console.error(`\n  ${pc.red('Error:')} ${message}\n`);
}

function formatBar(current: number, total: number): string {
  const width = 20;
  const t = Math.max(total, 1);
  const c = Math.max(Math.min(current, t), 0);
  const filled = Math.round((c / t) * width);
  const empty = width - filled;
  return `${pc.green('█'.repeat(filled))}${pc.dim('░'.repeat(empty))}`;
}

export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}
