# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

### Changed

### Deprecated

### Removed

### Fixed

- The `e2e-smoke` and `published-tag-smoke` verify steps no longer flake on GitHub's read-after-write replication lag. Their "branch head points at the reported commit" assertion read the scratch-branch head via the REST API immediately after the action's `updateRef` returned, and could observe the stale pre-commit head — the action had committed correctly, but the check reported a mismatch. Both steps now poll the branch head for the reported `commit-sha` with a bounded retry (up to 5 attempts, 3s apart) before failing, while keeping the hard failure after the budget so a genuine no-op (the #58 class of bug) is still caught (issue #96).

### Security

## [v0.3.0](https://github.com/vig-os/commit-action/releases/tag/v0.3.0) - 2026-07-15

### Added

- A new consumer-owned `js-quality` workflow gates every PR on `just lint` and `just format-check` (a new read-only recipe backed by `prettier --check src`). Neither eslint nor prettier was enforced anywhere before: the scaffold-managed `ci.yml` has a "Lint & Format" job, but it runs only the prek hook suite, which contains no JS linter or formatter. That is precisely how the broken globs above survived — the scripts were never run by anything but a human. Fixing them without a gate would have let them rot again the same way (issue #66).
- A new `e2e-smoke` workflow executes the **committed bundle** against the real GitHub API on every PR, running the action the way a consumer does (`uses: ./`) rather than importing its source. It commits a file to a scratch branch through the full REST flow and asserts the commit exists, is **signed**, and carries the expected content, then deletes the branch. Nothing previously executed `dist/index.js`: the unit tests import `main()` directly and the repo dogfoods `commit-action` at a pinned released SHA. That gap is not theoretical — the ESM migration found that the CommonJS `require.main === module` entry guard does not survive bundling to ESM, leaving the bundled action a silent no-op (exit 0, nothing committed) that 84 passing unit tests could not see (issue #58).
- CI now gates the committed ncc bundle against source drift so a stale `dist/index.js` can never reach a tag. A new consumer-owned `dist-check` workflow rebuilds the bundle on every PR to `release/**`/`main` and fails when the committed `dist/index.js` differs, and the release-time `release-extension` hook re-verifies the finalized commit before it is tagged (rolling the release back on drift). Both rebuild with the pinned dev-shell toolchain (issue #59). The gate is deliberately scoped to the release boundary — `dev` is not gated, since nothing ships from `dev` and gating it would fail every Renovate runtime-dependency bump (issue #71).

### Changed

- Adopted vigOS devkit `1.2.1` and declared the per-repo release tag scheme in `.vig-os`: `DEVKIT_TAG_PREFIX=v` restores this repo's historical `v`-prefixed tags (`vX.Y.Z`) through the release pipeline, and `DEVKIT_FLOATING_TAGS=major,minor` force-moves the floating `v0` / `v0.X` tags to each promoted release automatically — both were previously moved by hand. Consumers can pin `@v0` (floating major), an exact `@vX.Y.Z`, or a SHA (issue #62). The first attempt to ship 0.3.0 on devkit `1.2.0` failed in the automated release workflow: the scaffolded `release-core.yml` applied the draft + approval gate to every release kind, so a release-candidate dispatch aborted against its still-draft PR. 1.2.1 guards that gate behind `release_kind=final` (candidates gate on CI only), fixing the failure (vig-os/devkit#1095, issue #79). 1.2.1 also folds the `dist/src/` `tsc`/`ncc` declaration byproducts into the managed `.gitignore` (vig-os/devkit#1092), retiring this repo's bespoke `dist/.gitignore`, and moves the flake-generated `.pre-commit-config.yaml` symlink ignore to the new consumer-owned `.gitignore.project`; the `vigos` flake input is bumped to `1.2.1` to match the scaffold (issues #62, #79).
- **Migrated the action to ESM.** The `@actions/*` toolkit went ESM-only at its next major (no `require` condition in its `exports` map at all), so `@actions/core` v3, `@actions/github` v9 and `@actions/http-client` v4 were unlandable individually and had to move together (issues #49, #50, #51). The package is now `"type": "module"`, TypeScript resolves with `module`/`moduleResolution: nodenext`, relative imports carry explicit `.js` extensions, and `ncc` emits an ESM bundle (plus a small `dist/package.json` declaring the bundle's module type, now tracked alongside `dist/index.js`). Jest runs in ESM mode: the module mocks moved from `jest.mock` + a `__mocks__` manual mock to `jest.unstable_mockModule` with dynamic imports, and the old `src/__tests__/setup.ts` is gone. All 84 tests are preserved unchanged (issue #58).
- Dropping the classic `moduleResolution: node` also fixed a **silent type hole**: classic resolution ignores `exports` maps, so `@octokit/core/types` never resolved and every `octokit.rest.*` call in `src/commit.ts` degraded to `any` — the entire signed-commit REST flow was unchecked. Those calls are now type-checked against real Octokit types. This additionally unblocks TypeScript 7, which removes `moduleResolution: node` outright (issue #54).
- Removed the `@actions/http-client` and `undici` `overrides` pins. The `http-client` pin (`3.0.2`) was what actually blocked the v4 major, and the `undici` pin is now redundant: `@actions/http-client` v4 depends on `undici: ^6.23.0`, which resolves to the same `6.27.0` the pin was added to force (`npm audit` reports no runtime vulnerabilities).
- Migrated ESLint to flat config (`eslint.config.mjs`, replacing `.eslintrc.json`) and bumped `eslint` from `8.57` to `10.x`. ESLint 9 made flat config the default and ESLint 10 removed the legacy `.eslintrc` path entirely. The rule set is a faithful port — same base configs and the same two overrides — with the `node`/`es6`/`jest` environments becoming `languageOptions.globals`. `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` are replaced by the `typescript-eslint` meta package, the canonical v8 flat-config entry point (issue #64).
- **Renovate: update `undici` from `6.23.0` to `6.27.0`** ([#41](https://github.com/vig-os/commit-action/pull/41))
- **Renovate (batched): update development dependencies** — `jest` `29.7.0` → `30.4.2` and `@types/jest` → `30.0.0` ([#55](https://github.com/vig-os/commit-action/pull/55)); `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` `6.13.0` → `8.64.0` ([#56](https://github.com/vig-os/commit-action/pull/56)); `@vercel/ncc` `0.38.4` → `0.44.1` ([#46](https://github.com/vig-os/commit-action/pull/46)); `ts-jest` → `29.4.11` ([#45](https://github.com/vig-os/commit-action/pull/45)); `prettier` → `3.9.5` ([#47](https://github.com/vig-os/commit-action/pull/47)); `tsx` → `4.23.1` ([#48](https://github.com/vig-os/commit-action/pull/48)). Batched into one branch because each Renovate PR touched `package-lock.json` and `CHANGELOG.md` and so conflicted pairwise; the lockfile is regenerated once here rather than rebased six times. Side effect: `ts-jest` `29.4.11` drops `handlebars`, clearing the only `critical` advisory — known dev-dependency vulnerabilities go from 10 to 5.
- Retry for transient GitHub API failures is now applied at each individual REST call site inside `createTree` (per `createBlob` and per chained `createTree` chunk) instead of wrapping the whole multi-call tree operation; a transient mid-batch failure now retries only the failing call rather than re-uploading already-succeeded blobs and tree chunks (issue #24).
- Hardened `createTree` against oversized commit payloads: chunk boundaries are now **payload-size-aware** — a new `createTree` request starts once a chunk approaches **`TREE_ENTRY_BYTE_LIMIT` (6 MiB)** of approximate serialized content, in addition to the existing **`TREE_ENTRY_CHUNK_SIZE` (100)** entry cap (whichever limit is hit first). Text files whose size exceeds **`INLINE_CONTENT_SIZE_LIMIT` (1 MiB)** are now uploaded via `createBlob` (base64) instead of inlined, keeping requests well under GitHub's request-body limit for very large text change sets (issue #22).
- Migrated the action runtime from `node20` to `node24` ahead of GitHub removing the Node 20 Actions runtime on 2026-09-16 (issue #14). Bumped `@types/node` to the v24 line and raised the TypeScript `target`/`lib` to `ES2023`.
- Pre-release metadata fixes: corrected the `action.yml` `author` (was `Sync Issues Bot`, copy-pasted from `sync-issues-action`) and pinned the README Action usage example to `@v0.2.0`, dropping the now-obsolete `@main` note since the inline `createTree` optimization shipped in `v0.2.0` ([#63](https://github.com/vig-os/commit-action/issues/63)).

### Removed

- Untracked 32 build byproducts under `dist/src/` (`.d.ts`, `.js`, and `.map` files) that had been committed by accident. `tsconfig.json` sets `outDir: ./dist` with `declaration`/`declarationMap`, so both `npm run build` (tsc) and `npm run bundle` (ncc) emit them, while the `.gitignore` rule meant to exclude them (`dist/__tests__`) never matched their real path (`dist/src/__tests__`). The rule is now `dist/*` plus a `!dist/index.js` re-admit, so only the runtime artifact the action actually executes is tracked. Their `.d.ts.map` files embed absolute `file://` source paths and so were regenerated differently at every checkout location — which is what forced the #59 freshness gate to be scoped to `dist/index.js`; with them gone, both gates (`dist-check`, `release-extension`) now verify the whole `dist/` tree, and check it with `git status` rather than `git diff` so that build output which is emitted but never committed also fails the gate (issue #70).

### Fixed

- **`npm run lint` and `npm run format` had never checked the real source.** Both globbed with `src/**/*.ts`, but npm runs scripts through `sh`, which has no globstar — so `**` degraded to a single `*` and the pattern collapsed to `src/*/*.ts`, matching only files exactly one directory deep. In practice that was a single test-setup file; `src/commit.ts`, `src/commit-runner.ts` and `src/retry.ts` — the entire production surface — were matched by neither script. The scripts now pass the directory (`eslint src`, `prettier --write src`) and let each tool expand its own globs with correct `**` semantics (issue #66).
- Attached the originating error as `cause` when `commit-runner` rethrows a `git status` failure, so the underlying `execSync` error is no longer discarded (surfaced by the above; ESLint 10's `preserve-caught-error`).
- Removed a dead initializer on `bytesRead` in `isBinaryFromStat`. Not a correctness bug — the value was always overwritten before being read — but it masked the read from the compiler's definite-assignment analysis (`no-useless-assignment`).

## [v0.2.0](https://github.com/vig-os/commit-action/releases/tag/v0.2.0) - 2026-03-24

### Added

- Bounded retry with exponential backoff for transient GitHub API failures (`404`, `5xx`, `429`, and `403` when the error message indicates rate limit or abuse), configurable via **`MAX_ATTEMPTS`** and **`CommitOptions`** (`maxAttempts`, `logger`, optional `baseDelayMs` / `maxDelayMs`); new retry module helpers `isTransientError`, `classifyError`, `calculateDelay`, and `withRetry` (issue #20).
- Efficient multi-file commits via GitHub `createTree` **inline `content`** for text files (blobs created server-side), **`createBlob`** only for binary files (NUL detected in the first 8 KiB), and **chained `createTree`** requests in chunks of **`TREE_ENTRY_CHUNK_SIZE` (100)** entries for very large change sets and payload limits (issue #19).

### Changed

- README Action example uses a tagged release (`@v0.1.5`) instead of `@main` for reproducibility; unreleased behavior remains documented in the same section.
- Exported helpers for library use: `isBinaryFile`, `getFileMode`, and `TREE_ENTRY_CHUNK_SIZE` from `commit.ts`.
- Binary blob creation is now sequential instead of concurrent to avoid secondary rate-limit bursts.

### Fixed

- `withRetry` could surface `undefined` when `maxAttempts` was non-positive or non-finite; values are now normalized to at least one attempt.
- HTTP-like error detection for retries now requires `status` to be a number (avoids misclassifying odd error shapes).
- Non-UTF-8 text fallback in `createTree` delegates to `createBlob()` so blob behavior stays consistent.
- `isBinaryFile` false positives when `readSync` returns fewer bytes than requested (zero-filled buffer tail).
- Silent data corruption for non-UTF-8 text files by validating with `TextDecoder({ fatal: true })` and falling back to `createBlob`.

## [v0.1.5](https://github.com/vig-os/commit-action/releases/tag/v0.1.5) - 2026-03-13

### Fixed

- Excluded `.git` metadata paths during `FILE_PATHS` directory expansion to prevent malformed Git tree paths (issue #15).

## [v0.1.4](https://github.com/vig-os/commit-action/releases/tag/v0.1.4) - 2026-03-11

### Added

- Added `ALLOW_EMPTY` environment variable support to allow creating signed empty commits when no file changes are detected
- Added unit test coverage for empty commit behavior in `commitViaAPI()` and `commit-runner` flow handling

### Changed

- Updated npm dependency overrides to force patched `minimatch` versions across transitive dependency trees.
- Updated `commitViaAPI()` to support empty commits by reusing the parent tree SHA when `ALLOW_EMPTY=true`
- Updated runner behavior to preserve default no-op behavior when no files are detected, unless `ALLOW_EMPTY=true`
- Updated README usage examples and environment variable documentation for `ALLOW_EMPTY`
- Replaced `process.exit(0)` with early return in runner for improved testability

### Fixed

- Fixed missing `ALLOW_EMPTY` in commit-runner environment variable documentation

### Security

- Fixed `minimatch` ReDoS vulnerabilities (`CVE-2026-27903` / `GHSA-7r86-cg39-jmmj`) by pinning safe transitive versions via npm overrides.

## [v0.1.3](https://github.com/vig-os/commit-action/releases/tag/v0.1.3) - 2026-01-28

### Added

- Added `TARGET_BRANCH` environment variable support to avoid conflicts with GitHub's built-in `GITHUB_REF`
- Added `normalizeBranch()` and `resolveBranch()` exported functions for branch resolution logic
- Added comprehensive test suite for branch normalization and resolution (`commit-runner.test.ts`)

### Changed

- Improved branch resolution logic with explicit priority: `TARGET_BRANCH` > `GITHUB_REF` (if different from context) > workflow context
- Refactored branch resolution into testable exported functions

### Fixed

- Fixed Jest test failures by adding manual mock for `@actions/github` ESM module
- Fixed npm audit vulnerabilities by adding package overrides for `@actions/http-client@3.0.2` and `undici@6.23.0`

### Security

- Fixed moderate severity vulnerability in `undici` package (<6.23.0) by forcing upgrade via npm overrides

## [v0.1.1](https://github.com/vig-os/commit-action/releases/tag/v0.1.1) - 2025-12-19

### Changed

- Updated pull request template testing instructions to use `npm test` instead of Makefile commands
- Updated README with repository and organization links for better visibility

### Removed

- Removed outdated test options from pull request template (image tests, integration tests, registry tests)

### Fixed

- Fixed action execution by bundling code and updating .gitignore to exclude dist directory


## [v0.1.0](https://github.com/vig-os/commit-action/releases/tag/v0.1.0) - 2025-12-17

### Added

- Initial release of Commit Action
- Core `commitViaAPI()` function for creating commits via GitHub API
- Automatic commit signing through GitHub API
- Support for bypassing repository rulesets via API commits
- CLI runner (`commit-runner.ts`) with environment variable configuration
- Modular TypeScript implementation for reusability
- Support for both individual files and directories in `FILE_PATHS`
- Automatic file expansion for directories
- Git status auto-detection when `FILE_PATHS` is not provided
- GitHub Actions integration with `action.yml`
- Comprehensive unit test suite with Jest
- TypeScript type definitions and interfaces (`CommitOptions`, `CommitResult`)
- Helper functions: `createBlob`, `createTree`, `createCommit`, `updateBranch`, `getBranchInfo`
- Support for preserving file permissions (regular files and executables)
- Base64 encoding for file content
- Bundled distribution with ncc for GitHub Actions
