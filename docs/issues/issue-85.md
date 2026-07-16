---
type: issue
state: closed
created: 2026-07-15T13:46:19Z
updated: 2026-07-15T16:15:40Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/85
comments: 1
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-16T04:56:00.901Z
---

# [Issue 85]: [Remove the Dist Check bootstrap stub once 0.3.0 is promoted to main](https://github.com/vig-os/commit-action/issues/85)

## Context

The `Main protection` and `Release protection` rulesets require a passing **`Dist Check`** status. The real check (`.github/workflows/dist-check.yml`, #59) ships with **0.3.0** and is not yet on `main`, so any branch whose head predates it can never report the context and is permanently blocked.

To unblock the current set of PRs, a temporary **bootstrap stub** (`.github/workflows/dist-check-stub.yml`) emits an always-passing `Dist Check` job. It verifies nothing — it is a scaffold, deliberately at a distinct path so it does not add/add-conflict with the real `dist-check.yml` when `promote-release` merges `release/0.3.0 -> main`.

## Action required

**Delete `.github/workflows/dist-check-stub.yml` the moment 0.3.0 is promoted to `main`.** Once the real `dist-check.yml` lands there, both workflows report the `Dist Check` context and the always-green stub would **mask a genuine failure** of the real freshness gate.

## Acceptance criteria

- [ ] `dist-check-stub.yml` removed from `main` (and `dev`, if `sync-main-to-dev` propagated it) after 0.3.0 promotion.
- [ ] The only workflow reporting `Dist Check` on `main`/`release/**` is the real `dist-check.yml`.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 04:15 PM_

Resolved by #93 (`ci: remove the Dist Check bootstrap stub`), merged into `dev`. The stub is deleted; the real `dist-check.yml` (#59) — now on `main`/`dev` — reports the same contractual `Dist Check` context on `main`/`release/**` PRs, so the required check stays satisfied where it matters. (Closed manually: the PR targeted `dev`, not the default branch `main`, so the `Closes` keyword didn't auto-fire.)

