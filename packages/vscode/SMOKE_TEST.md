# F5 Smoke Test Checklist

Run this before publishing the extension. It exercises every code path the
bundle test can't (UI surfaces, real vscode API calls, webview rendering).

## Setup

1. Open `E:\dev\projects\temporal-git-vscode` in VS Code.
2. Open `packages/vscode/src/extension.ts`.
3. Press **F5** → "Extension Development Host" launches.
4. In the host, open a folder that's a git repo with a known bug you can
   reproduce with a test command (or use the temp repo script below).

### Quick temp repo

Run this in Git Bash before launching the host, then open `/tmp/ext-smoke-repo`:

```bash
rm -rf /tmp/ext-smoke-repo && mkdir /tmp/ext-smoke-repo && cd /tmp/ext-smoke-repo
git init -q -b main
git config user.email t@t.com && git config user.name t
git config core.autocrlf false
for i in 1 2 3 4 5 6; do printf 'process.exit(0);\n' > check.js; printf 'g%s\n' "$i" > m; git add .; git commit -q -m "good $i"; done
git tag v1
for i in 1 2 3; do printf 'process.exit(1);\n' > check.js; printf 'b%s\n' "$i" > m; git add .; git commit -q -m "bad $i"; done
```

## Tests

### 1. Automated bisect happy path

- [ ] `Ctrl+Alt+B` (or `Cmd+Alt+B` on Mac) opens the first input box
      — **verify the keybinding isn't stealing build task** (`Ctrl+Shift+B`
      should still open "Run Build Task")
- [ ] Enter `v1` for the good commit
- [ ] Enter `HEAD` for the bad commit (should be prefilled)
- [ ] Enter `node check.js` for the test command
- [ ] Progress notification appears: "Step 1/2", "Running: node check.js"
- [ ] Final notification: "Culprit found!"
- [ ] Webview panel opens on the right with:
  - [ ] Short commit hash (clickable to copy)
  - [ ] Commit subject in bold
  - [ ] Author and date
  - [ ] "View Diff" button → opens terminal running `git show <sha>`
  - [ ] "Copy Hash" button → copies SHA, toast confirms
  - [ ] **No** "Open in GitHub" button (this repo has no GitHub remote)

### 2. Already-active session

- [ ] Run automated bisect once (don't reset)
- [ ] `Ctrl+Alt+B` again → warning "A bisect session is already active"
- [ ] Click "Reset" → bisect resets, previous state cleared

### 3. Interactive bisect

- [ ] Command Palette → "Temporal Git: Start Interactive Bisect"
- [ ] Enter `v1` / `HEAD`
- [ ] Toast: "Bisect started. Now testing: <sha> — <message>"
- [ ] Palette → "Temporal Git: Mark Current Commit as Good"
- [ ] Toast: "Marked. Now testing: <sha> — <message>"
- [ ] Repeat Good/Bad until culprit found → webview opens

### 4. Skip

- [ ] Start a new interactive bisect
- [ ] Palette → "Temporal Git: Skip Current Commit"
- [ ] Toast: "Skipped. Now testing: <sha>"

### 5. Status / reset

- [ ] During an active session, Palette → "Reset Bisect Session"
- [ ] Toast: "Bisect session reset."
- [ ] Run "Mark Good" with no active session → warning toast

### 6. GitHub button (optional, if you have a real GitHub repo handy)

- [ ] Open a clone of one of your GitHub repos in the host
- [ ] Run an automated bisect
- [ ] Webview should show the "Open in GitHub" button
- [ ] Click → opens browser at `https://github.com/<owner>/<repo>/commit/<sha>`

### 7. Error surfaces

- [ ] Open VS Code with **no folder** → run any command → error toast:
      "Temporal Git requires an open workspace folder."
- [ ] Bad commit ref → error toast: "Bisect failed: ..."

## Publish (only after all checks pass)

```bash
cd packages/vscode
npx vsce login jordannewell        # one-time PAT
npx vsce publish 2.1.0             # or omit version to bump
```

Or upload the `.vsix` manually at https://marketplace.visualstudio.com/manage.
