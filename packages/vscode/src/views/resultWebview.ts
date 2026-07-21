import * as vscode from 'vscode';
import { BisectEngine, BisectResult } from '@temporal-git/core';

export async function showResultWebview(
  result: BisectResult,
  cwd: string,
  engine: BisectEngine
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'temporalGitResult',
    'Culprit Commit Found',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  // Determine GitHub remote up-front so the button renders only when it works.
  const remote = await engine.getGitHubRemote();

  panel.webview.html = getResultHtml(result, remote);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'showDiff') {
      // `git.showFile` isn't public; the supported way to open a commit's
      // diff in VS Code is to open its file at that ref via the git: → diff.
      // The cleanest stable surface is opening a quick compare: HEAD vs ref
      // is not exposed, so fall back to the SCM panel by running `git show`
      // in a terminal the user controls.
      const terminal = vscode.window.createTerminal({ name: `git show ${result.shortCommit}`, cwd });
      terminal.show();
      terminal.sendText(`git show ${result.shortCommit}`);
    } else if (message.command === 'openInGitHub' && remote) {
      vscode.env.openExternal(
        vscode.Uri.parse(
          `https://github.com/${remote}/commit/${result.commit}`
        )
      );
    } else if (message.command === 'copyHash') {
      await vscode.env.clipboard.writeText(result.shortCommit);
      vscode.window.showInformationMessage(`Copied ${result.shortCommit}`);
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getResultHtml(result: BisectResult, remote: string | null): string {
  const subject = escapeHtml(result.message.split('\n')[0] || '');
  const body = result.message.includes('\n')
    ? result.message.split('\n').slice(1).join('\n')
    : '';
  const bodyHtml = body
    ? `<div class="message-body">${escapeHtml(body)}</div>`
    : '';
  const githubButton = remote
    ? `<button class="secondary" onclick="openInGitHub()">Open in GitHub</button>`
    : '';

  return /*html*/ `<!DOCTYPE html>
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
    <span class="commit-hash" onclick="copyHash()">${escapeHtml(result.shortCommit)}</span>
    <div class="commit-message">${subject}</div>
    <div class="metadata">
      <span>${escapeHtml(result.author)}</span>
      <span>|</span>
      <span>${escapeHtml(formatDate(result.date))}</span>
    </div>
    ${bodyHtml}
  </div>

  <div class="actions">
    <button onclick="showDiff()">View Diff</button>
    <button class="secondary" onclick="copyHash()">Copy Hash</button>
    ${githubButton}
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}
