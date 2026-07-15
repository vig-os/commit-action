---
type: issue
state: closed
created: 2026-07-14T08:03:54Z
updated: 2026-07-14T08:16:55Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/36
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:34.779Z
---

# [Issue 36]: [[BUG] sync-main-to-dev fails: sync job checks out dev, then runs a local action that only exists on main](https://github.com/vig-os/commit-action/issues/36)

## Description

The `sync` job in `.github/workflows/sync-main-to-dev.yml` checks out `dev`, then
invokes a **local** composite action that currently only exists on `main`:

```yaml
      - name: Checkout dev
        uses: actions/checkout@…  # v7.0.0
        with:
          ref: dev               # ← workspace is now dev's tree
          fetch-depth: 0

      - name: Set up devkit toolchain
        uses: ./.github/actions/setup-devkit-toolchain   # ← resolved from dev's tree
```

GitHub resolves `uses: ./…` against the **checked-out workspace**, not the
workflow's ref. `.github/actions/` landed on `main` with the devkit 1.1.0 adoption
(#32) and is absent on `dev`, so the job dies immediately.

This is a **bootstrap deadlock**: the only thing that would carry the action onto
`dev` is the very sync PR this workflow can no longer open. `dev` is stuck 4
commits behind `main`.

## Steps to Reproduce

1. Push to `main` (any push since #32 merged).
2. `Sync main to dev` runs.
3. `resolve-toolchain` ✓ and `check` ✓ pass — both check out the **default** ref
   (`main`), where the action exists.
4. `sync` fails at `Set up devkit toolchain`.

Failing run: https://github.com/vig-os/commit-action/actions/runs/29314999211

## Expected Behavior

The sync job completes and opens the `chore/sync-main-to-dev-*` PR.

## Actual Behavior

```
Can't find 'action.yml', 'action.yaml' or 'Dockerfile' under
'/home/runner/work/commit-action/commit-action/.github/actions/setup-devkit-toolchain'.
Did you forget to run actions/checkout before running your local action?
```

## Possible Solution

Drop `ref: dev` from the sync job's checkout so the workspace is the triggering
`main` SHA, where the local action is guaranteed to exist. Nothing downstream reads
dev's **working tree** — every step operates on remote refs (`git fetch`,
`git rev-list origin/main ^origin/dev`, `git merge-tree origin/dev origin/main`,
`git checkout -b … origin/main`) or the GitHub API via `gh`. So the change is
behavior-preserving, and it makes the job build against the *newer* tree — the one
whose actions it references.

## Upstream

This file is the devkit scaffold template **verbatim**, so the defect ships to every
scaffolded repo. Filed upstream as
[`vig-os/devkit#1034`](https://github.com/vig-os/devkit/issues/1034).

This issue tracks the **local** fix so development can continue here without waiting
on a devkit release. Expect the eventual scaffold update to converge on the same
change; if it differs, re-sync to upstream then.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 08:16 AM_

Fixed by #37 (merged as \`f5f25c8\`).

Verified end-to-end on the first run of the fixed workflow — [run 29317285774](https://github.com/vig-os/commit-action/actions/runs/29317285774), triggered by the merge itself:

- `Set up devkit toolchain` (the step that used to fail) ✓
- `Detect merge conflicts` → clean ✓
- `Create sync branch from main` → `chore/sync-main-to-dev-2-1` ✓
- `Create PR` → #38, auto-merge enabled ✓

#38 has since merged. `dev` is now **0 commits behind `main`** and carries `.github/actions/`, so the bootstrap deadlock is broken and the workflow can self-heal from here.

Upstream scaffold fix still tracked at vig-os/devkit#1034.

