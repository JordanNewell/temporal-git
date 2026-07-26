# Contributing

Thanks for considering a contribution to **temporal-git** — the automated
git bisect CLI and VS Code extension. This doc covers dev setup, project
layout, testing, code style, and PR expectations.

> [!NOTE]
> External PRs that add new features are welcome but please open an issue
> first to scope the change. Bug fixes and docs can go straight to a PR.

## Project layout

This is a npm workspace monorepo:

```
.
├── packages/
│   ├── core/        # @temporal-git/core — bisect engine (shared)
│   ├── cli/         # temporal-git — the `temporal-git` CLI binary
│   └── vscode/      # temporal-git-vscode — the VS Code extension
├── assets/          # README hero/terminal/social-preview PNGs
└── .github/workflows/ci.yml
```

`core` is a pure-TypeScript library (no CLI concerns). `cli` wraps it with
a commander-based UX. `vscode` reuses core to expose the same engine
through VS Code commands.

## Dev setup

Requires **Node ≥ 18** and git.

```bash
git clone https://github.com/JordanNewell/temporal-git.git
cd temporal-git
npm install           # installs all workspaces
```

### Build everything

```bash
npm run build         # core → cli → vscode (compile)
npm run build:core    # just @temporal-git/core
npm run build:cli     # just temporal-git
npm run build:vscode  # just temporal-git-vscode
```

### Dev (watch)

```bash
npm run dev -w @temporal-git/core    # tsc --watch on the engine
npm run dev -w packages/cli          # tsc --watch on the CLI
```

### Run the CLI locally

After `npm run build:cli`:

```bash
node packages/cli/dist/bin/temporal-git.js run --good v1.0.0 --bad HEAD -- npm test
```

Or symlink for convenience:

```bash
npm link -w packages/cli
temporal-git --help
```

### Run the VS Code extension locally

Open `packages/vscode/` in VS Code and press `F5` (uses the bundled
`.vscode/launch.json` extensionDevelopmentHost). The extension host will
spawn with the locally compiled `out/extension.js`.

## Testing

Tests live in `packages/core/test/` and use **Node's built-in test runner**
(`node --test`, not Jest):

- `pure.test.js` — pure engine logic (no git invocations)
- `bisect.integration.test.js` — end-to-end runs that create real temp git
  repos and drive the engine through them

```bash
npm test                              # runs `npm run test -w @temporal-git/core`
npm run test -w @temporal-git/core    # explicit
```

`pretest` runs `npm run build` first, so you'll always test compiled
output. To run only the integration suite:

```bash
node --test packages/core/dist/test/bisect.integration.test.js
```

There is currently no CLI or VS Code test suite — exercise those by hand
with a real bisect scenario before sending a PR that touches either.

## Code style

- **TypeScript strict mode** — every `tsconfig.json` has `"strict": true`.
  `tsc -p .` must pass with zero errors.
- **No `any`** without a comment explaining why. Prefer `unknown` plus a
  type guard at the boundary.
- **Node 18 baseline** — `engines.node` is `>=18` on `cli` and `core`.
  Don't use APIs newer than Node 18 without gating.
- **No new runtime deps** without justification. The CLI deliberately
  stays small (commander, picocolors, simple-git). Dev deps should be
  scrutinized too.
- **Comments explain *why*, not *what*** — if a comment just restates the
  code below it, delete it.

## Commits

- Subject ≤ 72 chars, imperative mood (`Add X`, `Fix Y`).
- Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`) are used in this repo — match them when you can.
- Reference the issue number in the body if applicable.
- **No `Co-Authored-By: Claude` or any AI-attribution trailer.** Tools
  don't get attribution; humans do.

## Pull requests

Open a PR against `master`. CI must pass (builds all three workspaces and
runs `npm test`). If your change affects user-visible behavior:

- Update `README.md` (root) and the relevant package README if there is
  one.
- Bump versions per [SemVer](https://semver.org/): core / cli / vscode
  are versioned independently inside their own `package.json` files. Note
  the change in `CHANGELOG.md` if one is added before your PR.
- For VS Code extension changes that ship to the Marketplace, the
  `packages/vscode/package.json` version must be bumped — the publish
  step rejects unchanged versions.

### Release flow

Releases are triggered by a maintainer (currently manual `npm publish`
per workspace). Don't push tags as part of a PR.

## Filing issues

- 🐛 **Bugs** — include the output of `temporal-git --version`, the OS,
  Node version, and a minimal reproduction. If the bisect produced wrong
  output, paste the full terminal output (no secrets — git URLs and
  commit messages only).
- ✨ **Features** — describe the workflow you want, not the
  implementation. Concrete examples beat abstract proposals.
- 📚 **Docs** — typos, dead links, missing detail.

## Security disclosures

Do **not** open a public issue for security vulnerabilities. See
[`SECURITY.md`](SECURITY.md) for the private reporting path.

## License

By contributing, you agree your contributions are licensed under the
[MIT license](LICENSE).