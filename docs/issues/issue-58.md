---
type: issue
state: closed
created: 2026-07-14T09:08:44Z
updated: 2026-07-14T14:29:44Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/58
comments: 1
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:33.780Z
---

# [Issue 58]: [Migrate action to ESM (@actions/core v3, @actions/github v9, @actions/http-client v4)](https://github.com/vig-os/commit-action/issues/58)

## Description

The `@actions/*` toolkit has gone **ESM-only** at its next major. This repo is
CommonJS end to end, so all three pending majors are unlandable individually and
must move together:

- `@actions/core` v3 (#49)
- `@actions/github` v9 (#50)
- `@actions/http-client` v4 (#51)

Each ships `"type": "module"` with an `exports` map exposing only an `"import"`
condition — no `"require"`, no CJS entry point at all. `ncc`, bundling
`commit-runner.ts` for a CJS target, cannot resolve them:

```
Error: Module not found: Error: Package path . is not exported from package
  .../node_modules/@actions/github (see exports field in package.json)
```

and Jest cannot even load them:

```
FAIL src/__tests__/unit/commit-runner.test.ts
  ● Test suite failed to run
    Cannot find module '@actions/core' from 'src/__tests__/unit/commit-runner.test.ts'
```

**This is not an `overrides` problem.** Both were tested directly: removing the
`@actions/http-client` / `undici` pins from `overrides`, reinstalling, and re-running
reproduced byte-identical failures. Lifting the pins changes nothing.

## ⚠️ #51 is green and must NOT be merged

`@actions/http-client` v4 (#51) passes CI. It is green **only because CI never
bundles** — the workflows run `just sync` / `just precommit` / `just test` and never
call `just bundle`. `npm run bundle` fails on it exactly as it does on #49/#50.

Merging #51 would leave `dev` in a state where `dist/` **cannot be rebuilt**, and the
failure would surface later in the release cycle, on a change CI had already declared
safe. It is held for that reason, not merged.

## What the migration involves

1. **`package.json`** — add `"type": "module"`.
2. **`tsconfig.json`** — `module` / `moduleResolution` to `node16` / `nodenext`
   (or `bundler`). The current `"moduleResolution": "node"` (classic) is load-bearing
   in two ways beyond ESM:
   - it is **removed in TypeScript 7** (`error TS5108`, see #54), and
   - it **ignores `exports` maps**, which silently degrades types: under
     `@actions/github` v9 the `@octokit/core/types` import fails to resolve and
     `octokit.rest.*` collapses to `any`. Verified by probe:
     `octokit.rest.git.createBlob` types as `() => any`. Fixing
     `moduleResolution` **restores real Octokit types to `src/commit.ts`, which are
     currently unchecked** — expect latent type errors to surface, and treat that as
     the point of the exercise rather than a regression.
   - `lib` needs `ES2022` (`@octokit/request-error` uses the ES2022 `ErrorOptions`).
3. **Jest** — ESM mode (or a transform that handles it). The existing manual mock for
   `@actions/github` (added in v0.1.3, see CHANGELOG) will need reworking.
4. **Bundling** — confirm `ncc` can emit a working entry point from ESM sources, or
   replace it with `esbuild`. `action.yml`'s `main: "dist/index.js"` must keep working
   on the `node24` runtime.
5. **Verify for real** — the bundled `dist/index.js` must actually execute in a
   workflow. Unit tests passing is not sufficient evidence here; the whole class of
   bug in this issue is invisible to the current test suite.

## Acceptance

- `@actions/core` v3, `@actions/github` v9, `@actions/http-client` v4 all installed.
- `npm run lint` / `build` / `test` / `bundle` all pass.
- Bundled action runs end to end in a real workflow (signed-commit REST flow).
- `overrides` for `@actions/http-client` / `undici` re-evaluated — they may become
  unnecessary once the toolkit pulls its own current deps.

## Notes

Sizing: this is a real migration touching the build pipeline, not a dependency bump.
Independent estimates from two separate investigations landed at roughly half a day
to a day, dominated by the bundler and by re-verifying the REST flow against real
Octokit v7 response shapes (currently `any`-typed, therefore unvalidated).

Blocks / closes: #49, #50, #51.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 02:29 PM_

Done — shipped to `dev` in #74 (`a624eb2`). Closes #49, #50, #51 (all three auto-closed on merge) and unblocks #54.

## Acceptance

- ✅ `@actions/core` v3, `@actions/github` v9, `@actions/http-client` v4 all installed.
- ✅ `lint` / `build` / `test` / `bundle` all pass. 84/84 tests, 0 `tsc` errors, 92.5% coverage.
- ✅ **Bundled action runs end to end in a real workflow (signed-commit REST flow)** — see below.
- ✅ `overrides` re-evaluated: the `@actions/http-client` and `undici` pins are both **removed**. The `http-client` pin (`3.0.2`) was what actually blocked the v4 major; the `undici` pin is redundant, since `http-client` v4 depends on `undici: ^6.23.0` which resolves to the same `6.27.0` the pin forced. `npm audit --omit=dev` is clean.

## Two latent problems the migration surfaced — both invisible to the test suite

**1. The bundled action was a silent no-op.** The CJS `require.main === module` entry guard does not survive bundling to ESM: ncc rewrites it to `__nccwpck_require__.c[__nccwpck_require__.s] === module`, which evaluates false. The bundle loaded, exited 0, and committed nothing — with all 84 unit tests passing. Replaced with an `import.meta.url` / `process.argv[1]` comparison.

This is exactly the class of bug the issue warned about ("unit tests passing is not sufficient evidence"). Nothing in CI could have caught it: the unit tests import `main()` directly, and the repo dogfoods commit-action at a **pinned released SHA**, never at `./` — so `dist/index.js` was never executed by anything.

**2. The signed-commit REST flow was never type-checked.** As predicted, classic `moduleResolution: node` ignores `exports` maps, so `@octokit/core/types` never resolved and every `octokit.rest.*` call in `commit.ts` degraded to `any`. Under `nodenext` they type-check against real Octokit types. No latent type errors surfaced — `commit.ts` was already correct, just unverified.

## Gap closed permanently

Added an `e2e-smoke` workflow that runs the action **as a consumer does** (`uses: ./`) on every PR: it commits to a scratch branch through the real `createBlob → createTree → createCommit → updateRef` flow, then asserts the commit exists, is **signed**, and round-trips the expected content, and deletes the branch. Passed on first run against the real API under Octokit v7:

```
Created signed commit 9e51b2b6a14cacea74b325b1bb4efb7ed381cd0f via GitHub API
commit-sha=9e51b2b6a14cacea74b325b1bb4efb7ed381cd0f files-committed=1
Verified: signed commit ... with the expected content.
```

The non-empty `commit-sha` assertion is specifically what catches the no-op failure mode.

Closing (merged to `dev`, so it will not auto-close until release).

