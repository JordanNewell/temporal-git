# Security Policy

## Supported versions

Only the latest release receives security updates.

## Reporting a vulnerability

Email **security@jordannewell.com** with:

- A description of the issue and its impact
- Reproduction steps (a minimal example is ideal)
- Affected version — run `temporal-git --version`

**Do not open a public GitHub issue** for security reports.

If you have a PGP key, encrypt your report. GPG fingerprint of the project's
reporting key:

```
67567DC5E7C5353F85F2AF0DAC05D3F3E0EFA32A
```

## Response timeline

- **Acknowledgment:** within 72 hours
- **Initial assessment:** within 5 business days
- **Fix or mitigation:** target 30 days for high-severity issues

Please refrain from public disclosure until a fix has been published, to
protect downstream users. Reporters will be credited in the release notes
unless they prefer otherwise.

## Scope

**In scope:**

- The CLI itself (`temporal-git` and its subcommands)
- The git-bisect automation logic
- The VS Code extension code

**Out of scope:**

- git itself — report upstream
- VS Code — report to Microsoft
- Dependencies — report upstream