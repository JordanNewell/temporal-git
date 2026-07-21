# Changelog

## 2.1.0

Initial public release of the rewritten extension.

- Wraps the shared `@temporal-git/core` engine (no more duplicate bisect logic)
- Automated bisect via `Ctrl+Alt+B` / `Cmd+Alt+B` (deliberately avoids stealing VS Code's `Ctrl+Shift+B` build-task binding)
- Interactive bisect via the command palette
- Result webview with diff / copy-hash / open-in-GitHub actions
- Test command argv is now parsed correctly (quoted args with spaces survive through to `git bisect run`)
- Progress counts observed bisect steps rather than deriving from "revisions left" (which produced negative percentages)
