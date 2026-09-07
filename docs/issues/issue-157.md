---
type: issue
state: closed
created: 2026-09-07T07:54:05Z
updated: 2026-09-07T08:20:52Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/157
comments: 2
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-09-07T08:40:28.822Z
---

# [Issue 157]: [ci(release): rebuild the ncc bundle in prepare-release-extension.yml instead of by hand](https://github.com/vig-os/commit-action/issues/157)

The committed bundle `dist/index.js` on `dev` is stale again, for the third
time and for exactly the reason [#130](https://github.com/vig-os/commit-action/issues/130)
described. Rather than land another one-off rebuild commit, move the rebuild
into the release pipeline's designated mutating extension point so it stops
recurring.

## Current state

`src/`, `action.yml` and `README.md` are byte-identical to `v0.3.2`, but five
lock-file-maintenance PRs (#139, #143, #146, #148, #152) moved **runtime**
transitive dependencies that `ncc` inlines into the shipped bundle:

| package | v0.3.2 | dev |
|---|---|---|
| `@octokit/core` | 7.0.7 | 7.0.8 |
| `@octokit/request` | 10.0.13 | 10.0.16 |
| `@octokit/endpoint` | 11.0.4 | 11.0.5 |
| `@octokit/request-error` | 7.1.1 | 7.1.2 |
| `@octokit/graphql` | 9.0.4 | 9.0.5 |
| `content-type` (via `@octokit/request`) | 2.0.0 | 3.0.0 |

`@vercel/ncc` also moved `0.44.1` -> `0.45.0` (#142), so the bundler itself
differs. A clean `just sync && just bundle` from the current lock produces a
bundle that differs from the committed one (1 295 769 -> 1 295 957 bytes,
different SHA-256, one fewer webpack chunk as `content-type` 3.x is inlined
differently). `npm audit` is clean on both the old and the new lock, so this is
not a security fix — but it is a real change to the only artifact consumers of a
released tag execute.

## Why it keeps happening

The enforcement we have is read-only. `release-extension.yml`'s `verify-dist`
job rebuilds at finalize and **fails** the release, telling a human to go run
`just bundle` — a gate with no actuator. `dist-check.yml` is deliberately scoped
to pull requests into `release/**` and `main`, because gating `dev` made every
Renovate runtime-dep bump fail (#71), and nothing rebundles after lock-file
maintenance. So every release cycle inherits a stale bundle and needs a manual
rebuild PR before it can be cut.

## Proposal

`prepare-release-extension.yml` is a devkit-seeded no-op whose own header names
this use case verbatim: *"Replace this file to prepare the release branch before
the PR opens (e.g. rebuild + commit a generated artifact)."* It is
consumer-owned, so it survives re-scaffolds. The wiring in `prepare-release.yml`
already suits:

- `extension` needs `[validate, prepare]` — runs after `release/X.Y.Z` exists and
  has been fast-forwarded onto the changelog-freeze commit.
- `secrets: inherit` — it can mint the COMMIT_APP token and push to the
  write-protected release branch, the same bypass the freeze commit uses.
- `open-pr` needs `extension` — the release PR opens *after* the rebuild, so
  `Dist Check` sees a fresh bundle on its first run and the PR diff shows the
  real shipped-artifact change.
- `rollback` needs `extension` — a failed rebuild deletes the release branch,
  which erases the extension's commit. No new rollback machinery.

Replace the no-op with a job that resolves the toolchain from `.vig-os` (as
`release-extension.yml` does — toolchain inputs are not part of the
`workflow_call` contract), runs `just sync && just bundle`, and commits `dist/`
to the release branch only when it actually changed.

This turns the pipeline into build-then-verify: the extension produces the
bundle at prepare time, and `verify-dist` stays untouched at finalize as a
genuine backstop rather than the only gate. `dev` stays ungated, preserving the
#71 property.

## Acceptance criteria

- [ ] `prepare-release-extension.yml` rebuilds the bundle on `release/X.Y.Z` and
      commits it when it differs; no-ops cleanly when it does not.
- [ ] `dry_run` is honored — rebuild and report, never write.
- [ ] The commit is authored through `vig-os/commit-action` at its last released
      tag (not the un-rebuilt local `dist/`), matching how the changelog freeze
      commits.
- [ ] The commit message passes this repo's own `validate-commit-range` gate.
- [ ] `release-extension.yml` is unchanged and still verifies at finalize.
- [ ] `dist-check.yml` triggers are unchanged — `dev` stays ungated.

## Implementation notes

- Commit type: `.vig-os` leaves `DEVKIT_REFS_POLICY` empty, which resolves to
  `chore-optional` — every type but `chore` requires a `Refs:` line. A bot
  rebuild has no issue to reference, so the commit must be `chore(dist): ...`,
  matching the existing `chore: freeze changelog for release X.Y.Z`. A
  `build(dist):` subject would fail the gate.
- `just sync` already resolves to `npm ci` for a Node repo
  (`justfile.project:65`).
- A bugfix PR landing on `release/X.Y.Z` after prepare can still restale the
  bundle. That is covered: `Dist Check` triggers on pull requests into
  `release/**`, and `verify-dist` remains the final net.
- `release-core.yml`'s finalize pushes (changelog date stamp,
  `synthesize-bot-changelog`, the sync-issues commit) touch no source or lock
  file, so a bundle built at prepare time is still fresh at finalize.
- Accepted consequence: `dev`'s `dist/` stays stale between releases, refreshed
  when `sync-main-to-dev` brings the release commit back. That is already true
  today, and consumers run tags rather than `dev` SHAs.

## Related

- Recurrence of #130; same root cause, structural fix rather than another
  one-off rebuild.
- Unblocks the pending v0.3.3 cut, which currently fails both `Dist Check` on
  the release PR and `verify-dist` at finalize.

---

# [Comment #1]() by [c-vigo]()

_Posted on September 7, 2026 at 07:57 AM_

Re-verified against the branch base after #156 merged (`01f5cd7`), which added one more lock-file-maintenance PR to the window:

- `undici` moves `6.28.0` -> `6.28.1` on top of the octokit / `content-type` set in the description, so the runtime window is six lock-maintenance PRs (#139, #143, #146, #148, #152, #156), not five.
- `@actions/core` `3.0.1` and `@actions/github` `9.1.1` remain unchanged.
- `npm audit` is still clean on the current lock, with and without dev dependencies; the test suite is 84/84 green against it.

Nothing about the proposal changes — the window just grew by one PR, which is exactly the recurrence this issue is about.


---

# [Comment #2]() by [c-vigo]()

_Posted on September 7, 2026 at 08:20 AM_

Delivered in #158 (merged to `dev` as `c14c608`) and exercised for the first time by the 0.3.3 cut — [run 34099538885](https://github.com/vig-os/commit-action/actions/runs/34099538885).

Acceptance criteria, against that run:

- **Rebuilds and commits on `release/X.Y.Z`** — `Rebuild dist bundle` detected drift and pushed [`36d22ce`](https://github.com/vig-os/commit-action/commit/36d22cef7680cd4798d5db5ee2d92073c4a283b4) (`chore(dist): rebuild bundle for release 0.3.3`), GitHub-verified, authored by `commit-action-bot[bot]`.
- **Only the tracked artifact** — the commit touches `dist/index.js` alone (473 insertions / 346 deletions). No `dist/src/` byproducts leaked in, so the `git status` drift read did its job (vig-os/devkit#1159 / #134).
- **`dry_run` honored** — `Report dry-run outcome` was skipped on this non-dry run; the write step is gated on the same input.
- **Committed through the released tag** — `vig-os/commit-action@v0.3.2`, not the stale local bundle.
- **Commit message passes the repo's own gate** — `Commit Messages` green on the release PR #159, confirming `chore(dist):` clears `chore-optional`.
- **`release-extension.yml` and `dist-check.yml` untouched** — `dev` stays ungated.

The point of the exercise: **`Dist Check` passes on release PR #159**. Before this change that gate would have failed on the stale bundle, and the cut would have needed a hand-written rebuild PR first — which is what happened at #130 and was accruing again here.

Changelog synthesis also came out clean: no duplicate `#138` entry (removed in the same PR), and the `#### Dependencies` block covers all six lock-maintenance PRs, all four devkit adoptions, and every dev-dep bump at its net delta.

