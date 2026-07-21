import * as vscode from 'vscode';
import { BisectEngine } from '@temporal-git/core';
import { showResultWebview } from './views/resultWebview';

function getWorkspaceCwd(): string | undefined {
  // workspace.rootPath is deprecated; prefer workspaceFolders[0].
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getEngine(): BisectEngine | undefined {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    vscode.window.showErrorMessage('Temporal Git requires an open workspace folder.');
    return undefined;
  }
  return new BisectEngine(cwd);
}

function splitCommand(command: string): string[] {
  // Minimal shell-like split: respects single and double quotes.
  // Sufficient for 'npm test', 'make test "foo bar"', etc. We don't pull in a
  // full parser dependency for one input box.
  const result: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(command)) !== null) {
    result.push(m[1] ?? m[2] ?? m[3]);
  }
  return result;
}

export function activate(context: vscode.ExtensionContext) {
  // Bisect Run (automated)
  const bisectRun = vscode.commands.registerCommand('temporal-git.bisectRun', async () => {
    const engine = getEngine();
    if (!engine) return;

    if (await engine.isActive()) {
      const reset = await vscode.window.showWarningMessage(
        'A bisect session is already active. Reset it first?',
        'Reset', 'Cancel'
      );
      if (reset === 'Reset') {
        await engine.reset();
      } else {
        return;
      }
    }

    const good = await vscode.window.showInputBox({
      prompt: 'Good commit (last known working — tag, branch, or SHA)',
      placeHolder: 'v1.0.0',
    });
    if (!good) return;

    const bad = await vscode.window.showInputBox({
      prompt: 'Bad commit (contains the bug — tag, branch, or SHA)',
      placeHolder: 'HEAD',
      value: 'HEAD',
    });
    if (!bad) return;

    const command = await vscode.window.showInputBox({
      prompt: 'Test command to run on each commit (quote args containing spaces)',
      placeHolder: 'npm test',
    });
    if (!command) return;

    const argv = splitCommand(command);
    if (argv.length === 0) {
      vscode.window.showErrorMessage('Test command is empty.');
      return;
    }

    const cwd = getWorkspaceCwd()!;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Temporal Git: Bisecting...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: 'Starting bisect...' });
          await engine.start({ bad, good });

          const result = await engine.run({
            command: argv,
            cwd,
            onOutput(output) {
              const testLine = output.match(/running (.+)/);
              if (testLine) {
                progress.report({ message: `Running: ${testLine[1].trim().substring(0, 60)}` });
              }
            },
            onStep(step, total) {
              progress.report({
                message: `Step ${step}/${total}`,
                increment: 100 / total,
              });
            },
          });

          progress.report({ message: 'Culprit found!' });
          await showResultWebview(result, cwd, engine);
        } catch (err) {
          vscode.window.showErrorMessage(`Bisect failed: ${(err as Error).message}`);
        }
      }
    );
  });

  // Start Interactive Bisect
  const bisectStart = vscode.commands.registerCommand('temporal-git.bisectStart', async () => {
    const engine = getEngine();
    if (!engine) return;

    if (await engine.isActive()) {
      vscode.window.showWarningMessage(
        'A bisect session is already active. Reset it first with "Temporal Git: Reset Bisect Session".'
      );
      return;
    }

    const good = await vscode.window.showInputBox({
      prompt: 'Good commit (last known working)',
      placeHolder: 'v1.0.0',
    });
    if (!good) return;

    const bad = await vscode.window.showInputBox({
      prompt: 'Bad commit (contains the bug)',
      placeHolder: 'HEAD',
      value: 'HEAD',
    });
    if (!bad) return;

    try {
      await engine.start({ bad, good });
      const current = await engine.getCurrentCommit();
      vscode.window.showInformationMessage(
        `Bisect started. Now testing: ${current.shortHash} — ${current.message}`
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to start bisect: ${(err as Error).message}`);
    }
  });

  // Mark Good
  const bisectGood = vscode.commands.registerCommand('temporal-git.bisectGood', async () => {
    const engine = getEngine();
    if (!engine) return;

    if (!(await engine.isActive())) {
      vscode.window.showWarningMessage('No active bisect session.');
      return;
    }

    try {
      const output = await engine.mark('good');
      const cwd = getWorkspaceCwd()!;
      await handleMarkResult(engine, output, cwd);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
    }
  });

  // Mark Bad
  const bisectBad = vscode.commands.registerCommand('temporal-git.bisectBad', async () => {
    const engine = getEngine();
    if (!engine) return;

    if (!(await engine.isActive())) {
      vscode.window.showWarningMessage('No active bisect session.');
      return;
    }

    try {
      const output = await engine.mark('bad');
      const cwd = getWorkspaceCwd()!;
      await handleMarkResult(engine, output, cwd);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
    }
  });

  // Skip
  const bisectSkip = vscode.commands.registerCommand('temporal-git.bisectSkip', async () => {
    const engine = getEngine();
    if (!engine) return;

    try {
      await engine.mark('skip');
      const current = await engine.getCurrentCommit();
      vscode.window.showInformationMessage(
        `Skipped. Now testing: ${current.shortHash} — ${current.message}`
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
    }
  });

  // Reset
  const bisectReset = vscode.commands.registerCommand('temporal-git.bisectReset', async () => {
    const engine = getEngine();
    if (!engine) return;

    try {
      await engine.reset();
      vscode.window.showInformationMessage('Bisect session reset.');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to reset: ${(err as Error).message}`);
    }
  });

  context.subscriptions.push(
    bisectRun,
    bisectStart,
    bisectGood,
    bisectBad,
    bisectSkip,
    bisectReset
  );
}

const FIRST_BAD_COMMIT_REGEX = /^([0-9a-f]+) is the first bad commit$/m;

async function handleMarkResult(
  engine: BisectEngine,
  output: string,
  cwd: string
): Promise<void> {
  const firstBad = output.match(FIRST_BAD_COMMIT_REGEX);
  if (firstBad) {
    const result = await engine.getCommitInfo(firstBad[1]);
    await engine.reset();
    await showResultWebview(result, cwd, engine);
  } else {
    const current = await engine.getCurrentCommit();
    vscode.window.showInformationMessage(
      `Marked. Now testing: ${current.shortHash} — ${current.message}`
    );
  }
}

export function deactivate() {}
