import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exec } from './helpers';

import { BisectEngine } from '../bisect';

/**
 * Builds a throwaway git repo with N commits. Returns the array of SHAs
 * in creation order (oldest first). The "bug" is introduced at `badIdx`
 * (0-based): commits at or after that index write a failing script.
 *
 * The test command for bisect is `node <repo>/check.js`, which exits 0
 * (good) when the bug is absent and 1 (bad) when present.
 */
async function buildRepo(
  repoDir: string,
  numCommits: number,
  badIdx: number
): Promise<string[]> {
  await exec('git', ['init', '-q', '-b', 'main'], repoDir);
  await exec('git', ['config', 'user.email', 'test@example.com'], repoDir);
  await exec('git', ['config', 'user.name', 'Test'], repoDir);

  const shas: string[] = [];
  for (let i = 0; i < numCommits; i++) {
    const buggy = i >= badIdx;
    // Vary the marker file per commit so each commit is non-empty (git
    // refuses to create empty commits by default), and have check.js read
    // its result from that file so the test outcome depends on the commit.
    await writeFile(join(repoDir, 'marker.txt'), `commit ${i}\n`);
    const check = `process.exit(${buggy ? 1 : 0});\n`;
    await writeFile(join(repoDir, 'check.js'), check);
    await exec('git', ['add', 'check.js', 'marker.txt'], repoDir);
    await exec(
      'git',
      ['commit', '-q', '-m', `commit ${i}${buggy ? ' (buggy)' : ''}`],
      repoDir
    );
    const sha = (await exec('git', ['rev-parse', 'HEAD'], repoDir)).trim();
    shas.push(sha);
  }
  return shas;
}

test('BisectEngine.run: finds the first bad commit in a real repo', async () => {
  const repoDir = await mkdtemp(join(tmpdir(), 'tg-bisect-'));
  try {
    const shas = await buildRepo(repoDir, 8, /* badIdx */ 5);
    const expectedFirstBad = shas[5];

    const engine = new BisectEngine(repoDir);
    await engine.start({ bad: shas[7], good: shas[0] });

    const stepsSeen: Array<{ step: number; total: number }> = [];
    const result = await engine.run({
      command: ['node', 'check.js'],
      cwd: repoDir,
      onStep(step, total) {
        stepsSeen.push({ step, total });
      },
    });

    assert.equal(result.commit, expectedFirstBad);
    assert.ok(result.message.includes('commit 5'));
    assert.ok(result.message.includes('buggy'));
    assert.ok(result.shortCommit.length >= 7);

    // Every reported step must be positive (the bug we're guarding against).
    for (const { step, total } of stepsSeen) {
      assert.ok(step > 0, `step ${step} must be positive`);
      assert.ok(total > 0, `total ${total} must be positive`);
    }
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('BisectEngine.isActive: false outside any bisect session', async () => {
  const repoDir = await mkdtemp(join(tmpdir(), 'tg-active-'));
  try {
    await exec('git', ['init', '-q', '-b', 'main'], repoDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], repoDir);
    await exec('git', ['config', 'user.name', 'Test'], repoDir);
    await writeFile(join(repoDir, 'a.txt'), 'a');
    await exec('git', ['add', 'a.txt'], repoDir);
    await exec('git', ['commit', '-q', '-m', 'init'], repoDir);

    const engine = new BisectEngine(repoDir);
    assert.equal(await engine.isActive(), false);
    assert.equal(await engine.isInsideRepo(), true);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('BisectEngine.isInsideRepo: false outside any repo', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'tg-nogit-'));
  try {
    const engine = new BisectEngine(tmp);
    assert.equal(await engine.isInsideRepo(), false);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('BisectEngine.getGitHubRemote: null when no GitHub remote configured', async () => {
  const repoDir = await mkdtemp(join(tmpdir(), 'tg-remote-'));
  try {
    await exec('git', ['init', '-q', '-b', 'main'], repoDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], repoDir);
    await exec('git', ['config', 'user.name', 'Test'], repoDir);
    await exec('git', ['remote', 'add', 'origin', 'https://gitlab.com/o/r.git'], repoDir);

    const engine = new BisectEngine(repoDir);
    assert.equal(await engine.getGitHubRemote(), null);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('BisectEngine.getGitHubRemote: parses SSH GitHub remote', async () => {
  const repoDir = await mkdtemp(join(tmpdir(), 'tg-gh-remote-'));
  try {
    await exec('git', ['init', '-q', '-b', 'main'], repoDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], repoDir);
    await exec('git', ['config', 'user.name', 'Test'], repoDir);
    await exec('git', ['remote', 'add', 'origin', 'git@github.com:octocat/Hello-World.git'], repoDir);

    const engine = new BisectEngine(repoDir);
    assert.equal(await engine.getGitHubRemote(), 'octocat/Hello-World');
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});
