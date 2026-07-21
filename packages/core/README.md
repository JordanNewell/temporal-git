# @temporal-git/core

**Core git bisect engine for [temporal-git](https://github.com/JordanNewell/temporal-git).**

Shared by the `temporal-git` CLI and the VS Code extension so behavior can't drift between surfaces. Wraps `git bisect` with typed, tested plumbing.

## Install

```bash
npm install @temporal-git/core
```

Requires Node ≥ 18.

## Usage

```ts
import { BisectEngine } from '@temporal-git/core';

const engine = new BisectEngine(process.cwd());

await engine.start({ good: 'v1.0.0', bad: 'HEAD' });

const result = await engine.run({
  command: ['npm', 'test'],
  cwd: process.cwd(),
  onStep(step, total) {
    console.log(`Step ${step}/${total}`);
  },
  onOutput(output) {
    console.log(output);
  },
});

console.log(`Culprit: ${result.hash} — ${result.message}`);

await engine.reset();
```

## API

### `class BisectEngine`

| Method | Returns | Description |
|--------|---------|-------------|
| `new BisectEngine(cwd)` | `BisectEngine` | Construct for a git repo at `cwd` |
| `start({ good, bad, paths? })` | `Promise<void>` | `git bisect start` + mark good/bad bounds |
| `run({ command, cwd, onStep?, onOutput? })` | `Promise<BisectResult>` | `git bisect run` with progress callbacks; resolves to culprit |
| `mark('good' \| 'bad' \| 'skip', commit?)` | `Promise<string>` | Mark current (or specified) commit |
| `reset(commit?)` | `Promise<void>` | End session, return to original HEAD |
| `log()` | `Promise<string>` | Raw `git bisect log` output |
| `isActive()` | `Promise<boolean>` | Is a bisect session currently running? |
| `isInsideRepo()` | `Promise<boolean>` | Is `cwd` inside a git repo? |
| `getCommitInfo(hash)` | `Promise<BisectResult>` | Author, date, message, full metadata |
| `getCurrentCommit()` | `Promise<{ shortHash, hash, message }>` | The commit currently checked out |
| `getGitHubRemote()` | `Promise<string \| null>` | `"owner/repo"` if origin is GitHub, else null |

### Types

```ts
interface BisectOptions {
  good: string;           // tag, branch, or SHA
  bad: string;            // tag, branch, or SHA
  paths?: string[];       // limit to commits touching these paths
}

interface BisectResult {
  hash: string;
  shortHash: string;
  author: { name: string; email: string; date: string };
  message: string;        // commit subject
  body?: string;          // extended message body
}

interface RunOptions {
  command: string[];      // e.g. ['npm', 'test']
  cwd: string;
  onStep?: (step: number, total: number) => void;
  onOutput?: (output: string) => void;
}
```

### Helpers

- `parseGitHubOwnerRepo(remoteUrl)` — extract `"owner/repo"` from a git remote URL, or `null`
- `shellQuote(s)` — quote a single arg for shell transport
- `reduceBisectStep(state)` — pure reducer for bisect step state

## How it works

- `run()` uses `git bisect run <argv>`, which interprets exit codes: `0` = good, non-zero = bad, `125` = skip (e.g. won't build)
- Step counts come from observing `git bisect`'s actual output — we don't extrapolate percentages from "revisions left" because git's count can exceed the estimate and naïve math produces negative progress
- The engine ships with an integration test that builds a real temp git repo and verifies `run()` finds the known first-bad commit

## License

MIT — see [LICENSE](LICENSE).
