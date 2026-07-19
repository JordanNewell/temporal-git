# Temporal Git

**Automated git bisect. Find which commit introduced a bug with one command.**

## The Problem

You have a bug. You know it worked 3 months ago and it's broken now. There are 400 commits between then and now. Which one introduced it?

Without bisect: manually checking commits for hours.
With `git bisect`: binary search finds the culprit in **log₂(400) = 9 steps**.

The problem? `git bisect` has a terrible CLI UX. Most developers don't even know it exists. Temporal Git fixes that.

## Install

### CLI

```bash
npm install -g temporal-git
```

### VS Code Extension

```bash
code --install-extension jordannewell.temporal-git
```

## CLI Usage

### Automated Bisect

```bash
# Point it at a known-good commit, a known-bad commit, and a test command
temporal-git run --good v1.0.0 --bad HEAD -- npm test
```

Git checks out the midpoint commit, runs `npm test`, marks it pass/fail, repeats. When it finds the culprit:

```
  Bisecting between v1.0.0 and HEAD

  ████████████████████░░░░░ 75%

!  Found the culprit commit:

  abc1234d  Fix data transformation
  Author: john@example.com  |  2024-01-15T10:30:25

  The old code wasn't handling edge cases

  Run: git show abc1234d     Run: temporal-git reset
```

### Interactive Bisect

When you don't have a test command and need to manually verify each commit:

```bash
temporal-git start --good v1.0.0 --bad HEAD
```

Git checks out each midpoint commit. You test it yourself and mark it:

```
?  Current commit:
  abc1234d  Fix data transformation
  Author: john@example.com

  Is this commit (g)ood, (b)ad, or (s)kip? g
```

### Other Commands

```bash
temporal-git good [commit]     # Mark as good (during interactive session)
temporal-git bad [commit]      # Mark as bad
temporal-git skip [commit]     # Skip (e.g., won't build)
temporal-git reset              # End bisect session, return to original HEAD
temporal-git log                 # Show bisect session log
temporal-git status              # Show current bisect state
```

### Path-Limited Bisect

Only consider commits that touched specific files:

```bash
temporal-git run --good v1.0 --bad HEAD -- src/api/ -- npm test
```

## VS Code Extension

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+B` | Bisect This Bug (Automated) |
| Command Palette | Start Interactive Bisect |
| Command Palette | Mark Current Commit as Good |
| Command Palette | Mark Current Commit as Bad |
| Command Palette | Skip Current Commit |
| Command Palette | Reset Bisect Session |

### Automated Flow

1. `Ctrl+Shift+B` — or Command Palette → "Temporal Git: Bisect This Bug (Automated)"
2. Enter the good commit (last known working version)
3. Enter the bad commit (contains the bug, defaults to HEAD)
4. Enter the test command (`npm test`, `make test`, etc.)
5. Watch progress in the notification bar
6. Result opens in a webview panel with the culprit commit, author, and a diff link

## How It Works

`temporal-git` wraps `git bisect` with a better interface:

- **Automated mode**: uses `git bisect run <command>`, which interprets exit codes (0 = good, non-zero = bad, 125 = skip)
- **Interactive mode**: walks you through `git bisect start` → mark good/bad → find culprit → reset
- **Progress**: shows which commit is being tested and how many steps remain
- **Result**: displays the culprit commit with full context (SHA, author, date, message)

## Packages

This is a monorepo:

- [`packages/cli`](packages/cli) — the `temporal-git` npm CLI
- [`packages/vscode`](packages/vscode) — the VS Code extension

## Build

```bash
npm install
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
