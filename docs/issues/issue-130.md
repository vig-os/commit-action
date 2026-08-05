---
type: issue
state: closed
created: 2026-08-05T09:04:09Z
updated: 2026-08-05T09:15:11Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/130
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-08-05T09:41:14.830Z
---

# [Issue 130]: [build(dist): committed bundle is stale — undici 6.27.0 -> 6.28.0 never rebundled](https://github.com/vig-os/commit-action/issues/130)

The committed bundle `dist/index.js` on `dev` is stale: it no longer matches
`src/` built against the current `package-lock.json`. A local `just sync && just
bundle` produces a 146-insertion / 15-deletion diff.

## Cause

The scheduled lock-file maintenance PRs (#109, #116, #120) moved the transitive
dependency `undici` from `6.27.0` to `6.28.0`. `undici` is a **runtime**
dependency, not a dev one — it reaches the shipped bundle through both direct
dependencies:

```
@actions/core@3.0.1  -> @actions/http-client@4.0.1 -> undici@6.28.0
@actions/github@9.1.1 -> @actions/http-client@3.0.2 -> undici@6.28.0
                      -> undici@6.28.0
```

`ncc` inlines it, so the bundle content changes even though `src/` did not.

## Why nothing caught it

`dist-check.yml` triggers only on `pull_request` to `release/**` and `main`:

```yaml
on:
  pull_request:
    branches:
      - 'release/**'
      - main
```

Every Renovate PR targets `dev`, so `Dist Check` never ran on any of them and
the drift accumulated silently. The next release PR (`release/X.Y.Z` -> `main`)
is the first thing that would run it — and it would fail there, mid-release.

## Impact

Two things, one of them consumer-visible:

1. The v0.3.2 release PR fails its required `Dist Check` gate.
2. Consumers pinning a released tag are running the **older** bundled `undici`
   than the lockfile claims. 6.28.0 carries request-path hardening: header-value
   validation before coercion (rejecting values from a crafted `toString` /
   `Symbol.toPrimitive`, and invalid `content-type` from a blob body) and
   `Content-Length`-mismatch detection on partial/ranged responses.

## Acceptance criteria

- [ ] `just sync && just bundle` leaves `dist/index.js` unchanged
- [ ] `CHANGELOG.md` records the bundle refresh and the runtime movement it carries
- [ ] The `## Unreleased` lock-file-maintenance entry no longer claims the
      movement was dev-dependency-only

## Out of scope

- Widening the `dist-check.yml` trigger to `dev` (managed by devkit; would need
  an upstream change) — worth filing separately.
- The tracked-but-gitignored `dist/src/**` declaration byproducts, which carry
  absolute CI `sourceRoot` paths from the v0.3.0 finalize commit.

---

# [Comment #1]() by [c-vigo]()

_Posted on August 5, 2026 at 09:15 AM_

Resolved by #132 (merged as `17098c7`).

All three acceptance criteria verified on merged `dev` (`7b0f4dc`):

- `just sync && just bundle` leaves `dist/index.js` unchanged — re-verified after merge; only the gitignored-but-tracked `dist/src/**.d.ts.map` byproducts churn, and that is the expected absolute-`sourceRoot` difference between a local build and the CI runner path, so `Dist Check` sees a clean tree.
- `CHANGELOG.md` records the rebuild under `### Fixed`, naming the runtime movement it carries: `undici` 6.28.0 plus `@octokit/request` 10.0.13 / `@octokit/core` 7.0.7.
- The lock-file-maintenance entry no longer claims dev-dependency-only movement.

Scope note: the bundle diff turned out wider than this issue's title. #129 merged while the fix was in flight and moved `@octokit/*` as well, so the rebuild covers that too and the changelog entry was written against the full set rather than undici alone.

`E2E Smoke` on #132 executed the refreshed bundle against the live API, so the artifact is validated end to end, not merely diff-clean.

Both out-of-scope items above remain open work and are being filed separately.

