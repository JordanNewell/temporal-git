// Library entry — safe to import. Exports only types/engine, no side effects.
// The CLI entry lives in src/bin/temporal-git.ts and is referenced via `bin`.
export {
  BisectEngine,
  parseGitHubOwnerRepo,
} from '@temporal-git/core';
export type {
  BisectOptions,
  BisectResult,
  RunOptions,
} from '@temporal-git/core';
