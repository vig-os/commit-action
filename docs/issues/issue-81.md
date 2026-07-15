---
type: issue
state: closed
created: 2026-07-15T12:52:52Z
updated: 2026-07-15T14:11:07Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/81
comments: 0
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:12.290Z
---

# [Issue 81]: [Add published-tag consumer smoke: run the released artifact from its git tag](https://github.com/vig-os/commit-action/issues/81)

## Problem

The `e2e-smoke` workflow (#58) closed the "does the bundled action actually commit?" gap by running the action as `uses: ./` on every PR. But it runs the action from a **branch checkout**, never from the **published git tag** a real consumer pins (`uses: vig-os/commit-action@vX.Y.Z`). Nothing in the pipeline executes the released artifact *the way it is actually consumed*, from the tag ref, after it is pushed.

This matters most for release candidates: after `release.yml` pushes `vX.Y.Z-rcN`, we currently have no automated proof that a consumer pinning that tag gets a working, signing action on `node24`. Validating an RC by hand is the symptom.

## Why not fold it into the release pipeline

The project-owned `release-extension.yml` runs **before** `publish` (job graph `core -> extension -> publish`) and checks out `finalize_sha`, so the tag does not exist yet at extension time — it cannot `uses: @<tag>`. The `release.yml`/`-core`/`-publish` workflows are devkit-managed (regenerated on upgrade), so they should not be edited locally.

The clean, project-owned home is a **separate workflow triggered by the tag push itself**. The release pipeline pushes tags with the **Release App** token (not `GITHUB_TOKEN`), so tag-push events *do* trigger downstream workflows.

## Proposed solution

A new project-owned workflow (sibling of `e2e-smoke`) that:

- Triggers on `push: tags: ['v*.*.*']` (matches RCs `v0.3.0-rc1` and finals `v0.3.0`; excludes the floating `v0`/`v0.X` tags that move on promotion) **and** `workflow_dispatch` with a `ref` input, so we can trigger it for an already-pushed tag (e.g. the current `v0.3.0-rc1`).
- Checks out the action **at that tag** into a path and runs it via `uses: ./<path>` (GitHub forbids expressions in `uses:`, so the checkout-then-local-`uses` form is the faithful way to pin an arbitrary tag).
- Reuses the `e2e-smoke` assertions: create a scratch branch, commit a unique file through the REST flow, then assert the commit **exists**, is **signed** (`verification.verified == true`), and **round-trips the expected content**; delete the scratch branch on exit.

## Acceptance criteria

- [ ] Workflow runs automatically on any `vX.Y.Z` / `vX.Y.Z-rcN` tag push and asserts a signed commit from the tag artifact.
- [ ] `workflow_dispatch` accepts a tag ref and validates it (used to validate `v0.3.0-rc1`).
- [ ] No recursion (scratch-branch push does not re-trigger the tag filter) and no interference with the release pipeline.
- [ ] Lands on `main` (required for `workflow_dispatch` to be dispatchable).
