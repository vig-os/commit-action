---
type: issue
state: closed
created: 2026-07-14T09:08:53Z
updated: 2026-07-14T09:41:37Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/59
comments: 1
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:33.305Z
---

# [Issue 59]: [[FEATURE] Guarantee a fresh dist/ bundle on every tagged release (CI dist-check + release-extension verification)](https://github.com/vig-os/commit-action/issues/59)

## Description

Make it impossible to tag a release whose committed `dist/index.js` is stale relative to `src/`.

## Problem Statement

The devkit release pipeline tags `finalize_sha` — a commit containing whatever `dist/` happened to be on the release branch:

- `release-core.yml` runs `just sync` (:593) and `just test` (:596), but never `just bundle`; nothing rebuilds `dist/` at release time.
- The extension hook (`release-extension.yml`) runs **after** `finalize_sha` is computed and **before** `release-publish` tags that SHA, so it cannot add a bundle commit that would be included in the tag.
- Nothing in CI or pre-commit verifies `dist/` freshness today (`.pre-commit-config.yaml` explicitly excludes `dist/`).

Since consumers execute `dist/index.js` directly (`action.yml` → `main: dist/index.js`), a forgotten `just bundle` ships silently: tests pass against `src/`, the tag ships yesterday's bundle.

## Proposed Solution

Two mechanisms, both drift-free with respect to the devkit scaffold:

1. **CI freshness gate** — new consumer-owned workflow `.github/workflows/dist-check.yml` (separate file, so no edits to the scaffold-managed `ci.yml`): on `pull_request` to `dev`, `release/**`, `main` run `npm ci && npm run bundle && git diff --exit-code dist/`. Every commit that can reach a tag then has a fresh bundle by construction. Wire it as a required status check (#60).
2. **Release-time verification** — replace the default no-op in `release-extension.yml` (the designed project extension point) with a job that checks out `inputs.finalize_sha`, rebuilds, and diffs `dist/`. A stale bundle fails the `extension` job, which triggers the existing `rollback` in `release.yml`. Read-only verification, consistent with the hook's `contents: read` contract.

## Alternatives Considered

- Committing the bundle during finalize (edit `release-core.yml`): requires local drift in a scaffold-managed workflow and re-patching on every devkit upgrade.
- Pre-commit hook running ncc: slow on every commit; CI gate gives the same guarantee where it matters.
- Upstream note: a language-aware scaffold could ship this natively — related to vig-os/devkit#1027.

## Impact

Backward compatible; pure additive CI. Blocks the first release through the devkit pipeline until done (correctness gap).

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 09:41 AM_

Implemented by #69, merged to dev (19d688d). Both gates live: Dist Check passed on its own PR (1m07s) and is now a required status check on dev/release/*/main (#60). Bonus finding: dev's committed bundle was in fact stale (pre-bump undici) — rebuilt in 6476012. Follow-up for the dist/src/** cruft: #70.

