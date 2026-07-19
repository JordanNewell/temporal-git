import * as vscode from 'vscode';
import { BisectResult } from '../bisect';

export function showResultWebview(result: BisectResult, cwd: string): void {
  const panel = vscode.window.createWebviewPanel(
    'temporalGitResult',
    'Culprit Commit Found',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getResultHtml(result);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'showDiff') {
      const uri = vscode.Uri.file(cwd);
      await vscode.commands.executeCommand('git.show', result.shortCommit, uri);
    } else if (message.command === 'openInGitHub') {
      vscode.env.openExternal(
        vscode.Uri.parse(`https://github.com/${parseGitRemote(cwd)}/commit/${result.commit}`)
      );
    } else if (message.command === 'copyHash') {
      await vscode.env.clipboard.writeText(result.shortCommit);
      vscode.window.showInformationMessage(`Copied ${result.shortCommit}`);
    }
  });
}

function getResultHtml(result: BisectResult): string {
  return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Culprit Commit</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .header-icon { font-size: 32px; }
    h1 { font-size: 20px; margin: 0; }
    .commit-section {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .commit-hash {
      font-family: var(--vscode-editor-font-family);
      font-size: 14px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
    }
    .commit-hash:hover { text-decoration: underline; }
    .commit-message {
      font-size: 16px;
      font-weight: 600;
      margin: 8px 0;
    }
    .metadata {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .message-body {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      white-space: pre-wrap;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">!</div>
    <h1>Culprit Commit Found</h1>
  </div>

  <div class="commit-section">
    <span class="commit-hash" onclick="copyHash()">${result.commit}</span>
    <div class="commit-message">${result.message.split('\n')[0]}</div>
    <div class="metadata">
      <span>${result.author}</span>
      <span>|</span>
      <span>${new Date(result.date).toLocaleDateString()}</span>
    </div>
    ${result.message.includes('\n') ? `<div class="message-body">${result.message.split('\n').slice(1).join('\n')}</div>` : ''}
  </div>

  <div class="actions">
    <button onclick="showDiff()">View Diff</button>
    <button class="secondary" onclick="copyHash()">Copy Hash</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function showDiff() {
      vscode.postMessage({ command: 'showDiff' });
    }
    function copyHash() {
      vscode.postMessage({ command: 'copyHash' });
    }
    function openInGitHub() {
      vscode.postMessage({ command: 'openInGitHub' });
    }
  </script>
</body>
</html>`;
}

function parseGitRemote(_cwd: string): string {
  // Placeholder — in a real implementation, parse .git/config for the remote URL
  // and extract the owner/repo from it
  return 'owner/repo';
}
