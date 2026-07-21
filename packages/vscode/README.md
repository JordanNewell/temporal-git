# Temporal Git — Automated Git Bisect

**Find which commit introduced a bug, from inside VS Code.**

## Features

- **Bisect This Bug (Automated)** — `Ctrl+Alt+B` / `Cmd+Alt+B`. Enter a known-good commit, a known-bad commit, and a test command. Temporal Git runs `git bisect run` for you, reports progress in the notification bar, and opens the culprit commit in a webview panel.
- **Start Interactive Bisect** — when you don't have a programmatic test. After each checkout, the extension tells you which commit is being tested; use the palette commands to mark good/bad/skip.
- **Result webview** — culprit SHA, author, date, message body, plus buttons to view the diff, copy the hash, or open the commit on GitHub (the GitHub button appears only when the repo's `origin` remote resolves to GitHub).

## Commands

| Command | What it does |
|---------|--------------|
| `Temporal Git: Bisect This Bug (Automated)` | Prompt for good/bad refs + test command, run automated bisect |
| `Temporal Git: Start Interactive Bisect` | Prompt for good/bad refs, start interactive session |
| `Temporal Git: Mark Current Commit as Good` | `git bisect good` |
| `Temporal Git: Mark Current Commit as Bad` | `git bisect bad` |
| `Temporal Git: Skip Current Commit` | `git bisect skip` |
| `Temporal Git: Reset Bisect Session` | `git bisect reset`, return to original branch |

## How it works

The extension imports [`@temporal-git/core`](https://www.npmjs.com/package/@temporal-git/core), the same `BisectEngine` the `temporal-git` CLI uses. Behavior is identical between the two surfaces; bugs can't drift between them.

## Requirements

- VS Code ≥ 1.80
- A workspace folder open inside a git repository
- Node ≥ 18

## Install

Download the latest `.vsix` from [GitHub releases](https://github.com/JordanNewell/temporal-git/releases/latest), then:

```bash
code --install-extension temporal-git-vscode-2.1.0.vsix
```

Or from the Extensions panel in VS Code: `⋮` → "Install from VSIX..." → pick the downloaded file.

## License

MIT
