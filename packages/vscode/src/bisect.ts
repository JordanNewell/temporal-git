// Re-export from @temporal-git/core so the extension and CLI never drift.
// The engine is constructed with cwd=workspaceFolder by extension.ts.
export {
  BisectEngine,
  parseGitHubOwnerRepo,
} from '@temporal-git/core';
export type {
  BisectOptions,
  BisectResult,
  RunOptions,
} from '@temporal-git/core';
