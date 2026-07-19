import * as vscode from 'vscode';
import { BisectEngine } from './bisect';
import { showResultWebview } from './views/resultWebview';

export function activate(context: vscode.ExtensionContext) {
  function getEngine(): BisectEngine | undefined {
    const cwd = vscode.workspace.rootPath;
    if (!cwd) {
      vscode.window.showErrorMessage('Temporal Git requires an open workspace folder.');
      return undefined;
    }
    return new BisectEngine(cwd);
  }

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
      prompt: 'Test command to run on each commit',
      placeHolder: 'npm test',
    });
    if (!command) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Temporal Git: Bisecting...',
        cancellable: false,
      },
      async (progress) => {
        try {
          await engine.start(bad, good);

          const result = await engine.run(
            command,
            (output) => {
              const testLine = output.match(/running (.+)/);
              if (testLine) {
                progress.report({ message: `Running: ${testLine[1].trim().substring(0, 60)}` });
              }
            },
            (step, total) => {
              progress.report({ message: `Step ${step}/${total}`, increment: (100 / total) });
            }
          );

          progress.report({ message: 'Culprit found!' });
          showResultWebview(result, vscode.workspace.rootPath!);
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
      vscode.window.showWarningMessage('A bisect session is already active. Reset it first with "Temporal Git: Reset Bisect Session".');
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
      await engine.start(bad, good);
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
      const firstBad = output.match(/^([0-9a-f]+) is the first bad commit$/m);
      if (firstBad) {
        const result = await engine.getCommitInfo(firstBad[1]);
        await engine.reset();
        showResultWebview(result as any, vscode.workspace.rootPath!);
      } else {
        const current = await engine.getCurrentCommit();
        vscode.window.showInformationMessage(
          `Marked good. Now testing: ${current.shortHash} — ${current.message}`
        );
      }
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
      const firstBad = output.match(/^([0-9a-f]+) is the first bad commit$/m);
      if (firstBad) {
        const result = await engine.getCommitInfo(firstBad[1]);
        await engine.reset();
        showResultWebview(result as any, vscode.workspace.rootPath!);
      } else {
        const current = await engine.getCurrentCommit();
        vscode.window.showInformationMessage(
          `Marked bad. Now testing: ${current.shortHash} — ${current.message}`
        );
      }
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
      vscode.window.showInformationMessage(`Skipped. Now testing: ${current.shortHash} — ${current.message}`);
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

export function deactivate() {}
