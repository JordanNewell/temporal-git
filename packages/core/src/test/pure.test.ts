import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGitHubOwnerRepo,
  reduceBisectStep,
  shellQuote,
} from '../bisect';

test('parseGitHubOwnerRepo: SSH form', () => {
  assert.equal(
    parseGitHubOwnerRepo('git@github.com:owner/repo.git'),
    'owner/repo'
  );
  assert.equal(
    parseGitHubOwnerRepo('git@github.com:owner/repo'),
    'owner/repo'
  );
});

test('parseGitHubOwnerRepo: HTTPS form', () => {
  assert.equal(
    parseGitHubOwnerRepo('https://github.com/owner/repo.git'),
    'owner/repo'
  );
  assert.equal(
    parseGitHubOwnerRepo('https://github.com/owner/repo'),
    'owner/repo'
  );
  assert.equal(
    parseGitHubOwnerRepo('https://token@github.com/owner/repo.git'),
    'owner/repo'
  );
});

test('parseGitHubOwnerRepo: non-GitHub returns null', () => {
  assert.equal(
    parseGitHubOwnerRepo('git@gitlab.com:owner/repo.git'),
    null
  );
  assert.equal(
    parseGitHubOwnerRepo('https://bitbucket.org/owner/repo'),
    null
  );
  assert.equal(parseGitHubOwnerRepo(''), null);
});

test('reduceBisectStep: counts observed steps, not derived from revisions-left', () => {
  // Reproduction of the original bug: "5 revisions left, roughly 3 steps"
  // would compute step = 3 - 5 + 1 = -1 under the old formula. The reducer
  // instead treats this as step 1 and records the reported total as the
  // initial estimate.
  const first = reduceBisectStep(
    { step: 0, totalEstimate: 0 },
    'Bisecting: 5 revisions left to test after this (roughly 3 steps)'
  );
  assert.equal(first.step, 1);
  assert.ok(first.totalEstimate >= 1, 'totalEstimate should be positive');
});

test('reduceBisectStep: monotonically increases step across chunks', () => {
  const chunks = [
    'Bisecting: 7 revisions left to test after this (roughly 3 steps)',
    'Bisecting: 3 revisions left to test after this (roughly 2 steps)',
    'Bisecting: 1 revisions left to test after this (roughly 1 step)',
  ];
  let state = { step: 0, totalEstimate: 0 };
  const steps: number[] = [];
  for (const c of chunks) {
    state = reduceBisectStep(state, c);
    steps.push(state.step);
  }
  assert.deepEqual(steps, [1, 2, 3]);
  for (const s of steps) {
    assert.ok(s > 0, `step ${s} must be positive`);
  }
});

test('reduceBisectStep: non-bisect chunks are no-ops', () => {
  const before = { step: 2, totalEstimate: 5 };
  const after = reduceBisectStep(before, 'some random git output');
  assert.equal(after, before);
});

test('shellQuote: wraps simple args in single quotes', () => {
  assert.equal(shellQuote('npm'), `'npm'`);
  assert.equal(shellQuote('test'), `'test'`);
});

test('shellQuote: escapes embedded single quotes', () => {
  // POSIX idiom: close, escaped-quote, reopen.
  assert.equal(shellQuote(`it's`), `'it'\\''s'`);
});

test('shellQuote: round-trips args with spaces intact', () => {
  // What git bisect run will re-assemble via `sh -c`:
  const argv = ['npm', 'test', '--grep', 'foo bar'];
  const joined = argv.map(shellQuote).join(' ');
  // sh -c parses joined back into the same argv.
  assert.equal(joined, `'npm' 'test' '--grep' 'foo bar'`);
});
