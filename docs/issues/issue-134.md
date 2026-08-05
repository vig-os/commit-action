---
type: issue
state: closed
created: 2026-08-05T09:19:09Z
updated: 2026-08-05T09:23:14Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/134
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-08-05T09:41:14.005Z
---

# [Issue 134]: [chore(dist): untrack the gitignored dist/src byproducts left by the v0.3.0 finalize commit](https://github.com/vig-os/commit-action/issues/134)

## Problem

Two release gates document the same invariant in their headers, and it is currently false.

`.github/workflows/dist-check.yml`:

> since #70 gitignored the declaration byproducts under `dist/src/` — `just bundle` still re-emits them here, but git no longer sees them — so `dist/` tracks only the real artifact.

`.github/workflows/release-extension.yml`:

> `dist/index.js` [...] since #70 gitignored the declaration byproducts under `dist/src/`, the only thing tracked under `dist/` — so a tree-wide check is now both deterministic and strictly stronger.

But `git ls-files dist/` lists 14 paths, 12 of them under `dist/src/`:

```
dist/index.js
dist/package.json
dist/src/__tests__/unit/commit-runner.test.d.ts(.map)
dist/src/__tests__/unit/commit.test.d.ts(.map)
dist/src/__tests__/unit/retry.test.d.ts(.map)
dist/src/commit-runner.d.ts(.map)
dist/src/commit.d.ts(.map)
dist/src/retry.d.ts(.map)
```

`.gitignore` ignores `dist/src/` (line 51), but gitignore does not untrack — these were re-added by the v0.3.0 finalize commit (`1260b1d`), the vig-os/devkit#1159 bug in which `commit-action` walked a bare `dist` directory path and force-added every file it found without consulting `.gitignore`. devkit fixed that upstream (`release-core.yml` now derives its paths from `git ls-files -co --exclude-standard`), but the already-tracked residue was never cleaned up here.

## Why it matters

Each `.d.ts.map` embeds an absolute `sourceRoot`:

```json
"sources":["file:///home/runner/work/commit-action/commit-action/src/retry.ts"]
```

So the "deterministic across checkout locations" property both gates claim to rely on does not actually hold. The tree-wide `git status -- dist/` check passes only because CI happens to rebuild at the same absolute path that was committed. A rebuild anywhere else — any developer machine — reports six modified files.

That is a live trap, not a theoretical one. Preparing the v0.3.2 bundle refresh (#130) required hand-staging `dist/index.js` and explicitly restoring `dist/src/`, because committing a locally built tree would have written developer-machine paths into the repo and failed `Dist Check` in CI on the next run.

It also makes local verification untrustworthy: `just bundle && git status -- dist/` cannot currently be read as a clean/dirty signal, which is precisely the assertion `Dist Check` makes.

## Proposed fix

`git rm -r --cached dist/src` — stop tracking the byproducts, leaving them ignored and regenerated locally, as #70 intended.

## Impact on the release gates (verified)

- `release-core.yml` derives `DIST_PATHS` from `git ls-files -co --exclude-standard -- dist`. After untracking, that yields exactly `dist/index.js,dist/package.json` — non-empty, so the "bundle recipe produced no non-ignored files" guard stays satisfied, and the finalize commit stops re-committing runner paths into every release tag.
- `dist-check.yml` runs `git status --porcelain -- dist/`. Untracked-and-ignored files are not reported, so the check stays clean in CI and becomes genuinely deterministic everywhere else.
- `release-extension.yml`'s tree-wide verification gains the determinism its header already claims.

No consumer-visible change: `action.yml` runs `dist/index.js`, which stays tracked. The `.d.ts` declarations are build byproducts with no runtime role.

## Acceptance criteria

- [ ] `git ls-files dist/` lists only `dist/index.js` and `dist/package.json`
- [ ] After `just sync && just bundle`, `git status --porcelain -- dist/` is empty on a developer machine
- [ ] `CHANGELOG.md` records the cleanup under `## Unreleased`

## Timing

Before the v0.3.2 release. Deferring means the finalize commit re-commits the `/home/runner` paths into the v0.3.2 tag and the hazard survives another cycle.

---

# [Comment #1]() by [c-vigo]()

_Posted on August 5, 2026 at 09:23 AM_

Resolved by #135 (merged as `bd96090`).

All acceptance criteria verified on merged `dev`:

- `git ls-files dist/` lists only `dist/index.js` and `dist/package.json`.
- After `just sync && just bundle`, `git status --porcelain -- dist/` is empty on a developer machine — so local bundle verification is a trustworthy clean/dirty signal for the first time, matching the assertion `Dist Check` makes in CI.
- `CHANGELOG.md` records the cleanup under `## Unreleased` → `### Fixed`.

`release-core.yml`'s `DIST_PATHS` (`git ls-files -co --exclude-standard -- dist`) now resolves to `dist/index.js,dist/package.json` — non-empty, so its no-files guard still holds, and the finalize commit will stop writing runner paths into each release tag. `E2E Smoke` passed on #135 having executed the committed bundle against the live API, confirming the shipped artifact is undisturbed.

Note for future reference: issues do not auto-close from the `Closes #N` keyword here, because these PRs merge into `dev` rather than the default branch. Same applied to #130 and #131.

