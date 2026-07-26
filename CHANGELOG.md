# Changelog

All notable changes to Temporal Git are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] — 2026-07-21

This release corresponds to the workspace bump landed in commit
`f14b100` (`core 2.1.1 + cli 2.1.4`). No formal GitHub release was
published; entries below are sourced from commit history.

### Added

- **Per-package READMEs** for `@temporal-git/core` and the VS Code
  extension.
- **Funding fields** (`funding.yml` + npm `funding` keys) across the
  workspace.

### Changed

- **`@temporal-git/core` bumped to 2.1.1.**
- **`@temporal-git/cli` bumped to 2.1.4.**

## [2.1.0] — 2026-07-21

Sourced from commit `a690707` ("Temporal Git v2.1: extract
@temporal-git/core, fix install + correctness bugs"). No formal
GitHub release was published.

### Added

- **`@temporal-git/core` extracted** as a standalone workspace
  package, separate from the CLI.

### Fixed

- **`--version` reporting stale `2.0.0`** in the CLI.
- **npm stripping the `bin` entry** — removed the `./` prefix from
  the bin path.
- **Install correctness bugs** carried over from the v2.0 monolith.
- **`--no-reset` flag** not honored.

### Changed

- **`publishConfig` added** to `@temporal-git/core`.
- **LICENSE added** to each package and included in the files
  allowlists.

## [2.0.0] — 2026-07-19

Initial public release. Sourced from commit `c282d4d` ("Temporal Git
v2.0: automated git bisect CLI + VS Code extension"). No formal
GitHub release was published.

### Added

- **Automated `git bisect` CLI** that finds which commit introduced a
  bug — runs the test, walks the history, reports the blame commit.
- **VS Code extension** bundling the bisect workflow into the editor.
- **Workspace monorepo** layout: `packages/core`, `packages/cli`,
  `packages/vscode`.

[Unreleased]: https://github.com/JordanNewell/temporal-git/commits/master
[2.1.1]: https://github.com/JordanNewell/temporal-git/commit/f14b100
[2.1.0]: https://github.com/JordanNewell/temporal-git/commit/a690707
[2.0.0]: https://github.com/JordanNewell/temporal-git/commit/c282d4d