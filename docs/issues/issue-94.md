---
type: issue
state: closed
created: 2026-07-15T16:38:42Z
updated: 2026-07-15T16:50:47Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/94
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-16T04:56:00.557Z
---

# [Issue 94]: [ci: drop top-level `contents: write` from smoke workflows](https://github.com/vig-os/commit-action/issues/94)

## Problem

OpenSSF Scorecard's TokenPermissions check scores **0** because two workflows grant `contents: write` at the **top level** (workflow scope), exposing a write token to every job and step by default:

- `.github/workflows/e2e-smoke.yml` — code-scanning alert #27
- `.github/workflows/published-tag-smoke.yml` — code-scanning alert #23

Both workflows genuinely need `contents: write` (they push a scratch branch and the action under test commits to it), but only inside their single job.

## Fix

In both files:

- top level: `permissions: {}` (restrict default; job declares its own — same pattern as `codeql.yml` / `scorecard.yml` / `sync-issues.yml`)
- job level: `contents: write` with a comment stating why (scratch-branch push + action commit)

## Verification

- `e2e-smoke` runs on `pull_request` to `dev`, so the PR itself exercises it.
- `published-tag-smoke`: `gh workflow run` on the PR branch with `ref=v0.3.0` to validate the released tag path.
- After merge to `main`, the next Scorecard analysis should close alerts #27 and #23 and lift the TokenPermissions score off 0.

## Out of scope

Job-level `contents: write` in the release pipeline (17 remaining Scorecard alerts) — tracked separately; several of those files are devkit-managed and any change belongs upstream.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 04:50 PM_

Fixed by #95 (merged as 63d951b). Scorecard alerts #27/#23 will auto-close once the change reaches main and the next analysis runs.

