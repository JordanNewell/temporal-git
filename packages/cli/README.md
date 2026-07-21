# temporal-git

**Automated git bisect. Find which commit introduced a bug with one command.**

You have a bug. You know it worked three months ago, and it's broken now. There are 400 commits between then and now. Which one introduced it?

Without bisect: manually checking commits for hours. With `git bisect`: binary search finds the culprit in **log₂(400) ≈ 9 steps**. The problem is `git bisect`'s terrible CLI UX. `temporal-git` fixes that.

## Install

```bash
npm install -g temporal-git
```

Requires Node ≥ 18.

## Quick start

```bash
temporal-git run --good v1.0.0 --bad HEAD -- npm test
```

That's it. Git checks out the midpoint commit, runs `npm test`, marks it pass or fail, and repeats. When it finds the culprit:

```
  Bisecting between v1.0.0 and HEAD

  Bisecting ████████████████░░░░░ 75% (step 3/4)

!  Found the culprit commit:

  158eca1  Fix data transformation
  Author: Jordan Newell  |  2026-07-21T00:17:22

  The old code wasn't handling edge cases properly. We need to validate
  the input shape before transforming.

  Run: git show 158eca1     Run: temporal-git reset
```

## Commands

```
Usage: temporal-git [options] [command]

Commands:
  run [options] <command> [args...]  Run automated bisect with a test command
  start [options]                    Start an interactive bisect session
  good|g [commit]                    Mark current (or specified) commit as good
  bad|b [commit]                     Mark current (or specified) commit as bad
  skip|s [commit]                    Skip current (or specified) commit
  reset|r [commit]                   Reset the bisect session, return to original HEAD
  log                                Show the bisect session log
  status                             Show current bisect status
```

### Automated bisect

Point it at a known-good ref, a known-bad ref, and a test command. The test command follows `--` and is passed to `git bisect run`:

```bash
# npm test
temporal-git run --good v1.0.0 --bad HEAD -- npm test

# make target
temporal-git run --good v1.0.0 --bad HEAD -- make test

# any script — args with spaces get quoted through correctly
temporal-git run --good v1.0.0 --bad HEAD -- npm test --grep "user signup"

# any refs work — tags, branches, SHAs
temporal-git run --good abc1234 --bad feature-branch -- pytest tests/
```

Git interprets exit codes per `git bisect run` convention: `0` = good, non-zero = bad, `125` = skip (e.g. won't build).

### Interactive bisect

When you don't have a test command and need to verify each commit manually:

```bash
temporal-git start --good v1.0.0 --bad HEAD
```

Git checks out each midpoint commit. You test it yourself and mark it:

```
  Bisecting between v1.0.0 and HEAD

?  Current commit:
  bc4846e  follow-up 2
  Author: Jordan Newell

  Is this commit (g)ood, (b)ad, or (s)kip? g
```

### Path-limited bisect

Only consider commits that touched specific paths — narrows the search space dramatically when the bug is isolated to one module:

```bash
temporal-git run --good v1.0 --bad HEAD --path src/api/ -- npm test
temporal-git run --good v1.0 --bad HEAD --path src/api/ src/auth/ -- make test
```

### Marking commits manually

During an interactive session you can mark from any terminal:

```bash
temporal-git good         # mark current HEAD as good
temporal-git good abc123  # mark a specific commit as good
temporal-git bad          # mark current HEAD as bad
temporal-git skip         # skip current commit (e.g. won't build)
temporal-git log          # show the full bisect log
temporal-git status       # is a session active?
temporal-git reset        # end the session, return to original branch
```

### Keeping bisect refs

By default `run` resets the session after finding the culprit. Pass `--no-reset` to keep the bisect refs around:

```bash
temporal-git run --good v1.0.0 --bad HEAD --no-reset -- npm test
# then later:
temporal-git log
temporal-git reset   # clean up when done
```

## VS Code extension

There's a companion VS Code extension that exposes the same engine via command palette + `Ctrl+Alt+B`. Install it from [GitHub releases](https://github.com/JordanNewell/temporal-git/releases).

## License

MIT — see [LICENSE](LICENSE).
