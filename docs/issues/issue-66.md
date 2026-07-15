---
type: issue
state: closed
created: 2026-07-14T09:14:41Z
updated: 2026-07-14T14:58:40Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/66
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:29.930Z
---

# [Issue 66]: [[BUG] npm run lint/format only ever check one file — sh has no globstar, so src/**/*.ts collapses to src/*/*.ts](https://github.com/vig-os/commit-action/issues/66)

## Description

`npm run lint` and `npm run format` have **never touched the real source**. Both
scripts glob with `src/**/*.ts`:

```json
"lint":   "eslint src/**/*.ts",
"format": "prettier --write src/**/*.ts"
```

npm runs scripts through `sh`, which has **no globstar**. `**` therefore degrades to
a single `*`, and the pattern collapses to `src/*/*.ts` — files exactly one directory
deep:

```console
$ sh -c 'echo src/**/*.ts'
src/__tests__/setup.ts
```

**One file.** `src/commit.ts`, `src/commit-runner.ts`, and `src/retry.ts` — the entire
production surface — are matched by neither script. The "Lint & Format" CI job has
been green on that basis since the scripts were written.

## Steps to Reproduce

```console
$ npx eslint src/**/*.ts --format json | jq length
1

$ npx eslint src --format json | jq length
8
```

## Expected Behavior

`npm run lint` lints every `.ts` file under `src/`; `npm run format` formats them.

## Actual Behavior

Both operate on `src/__tests__/setup.ts` alone. Linting the real tree surfaces
**29 errors and 17 warnings across 8 files**, and `prettier --list-different src`
reports **all 8 files** as unformatted.

## The hidden findings

Inventory as of `eslint` 10 + `typescript-eslint` 8 (post-#65):

| Where | Finding | Notes |
|---|---|---|
| test mocks / suites | `@typescript-eslint/no-require-imports` ×~25 | `require()` in jest mocks — defensible; wants a rule override scoped to `src/__tests__/**` |
| `src/commit-runner.ts:177` | `preserve-caught-error` | no `cause` attached to a rethrown error (new ESLint 10 rule) |
| `src/commit.ts:85` | `no-useless-assignment` | dead initializer on `bytesRead` — the value is overwritten in the `try` before any read |
| various | `@typescript-eslint/no-explicit-any` ×17 (warn) | pre-existing `any` usage |

**Neither production-source finding is a correctness bug** — I checked `commit.ts:85`
specifically, given the history of readSync bugs in `isBinaryFromStat` (see the v0.2.0
`isBinaryFile` fix). The initializer is dead but harmless; `bytesRead` is definitely
assigned before it is read.

## Possible Solution

1. Fix the scripts so the glob is not shell-dependent — let the tools do their own
   matching:
   ```diff
   -  "lint":   "eslint src/**/*.ts",
   -  "format": "prettier --write src/**/*.ts",
   +  "lint":   "eslint src",
   +  "format": "prettier --write src",
   ```
   ESLint's flat config already scopes to `src/**/*.ts` via its `files` key (#65), and
   ESLint/Prettier expand globs internally with correct `**` semantics.
2. Add a rule override allowing `require()` under `src/__tests__/**`.
3. Fix the two production findings.
4. Run `prettier --write src` once and commit the reformat — expect a large, purely
   mechanical diff across all 8 files. **Worth doing as its own commit** so it can be
   reviewed (or skipped) independently of the substantive fixes.

## Notes

Deliberately kept out of #65 (the flat-config migration): folding a 46-finding triage
and a whole-source reformat into a config migration would have made both unreviewable.
#65 verifies ESLint 10 works by invoking `npx eslint src` directly, which sidesteps the
broken script.

Worth checking whether the scaffolded `justfile.project` `lint`/`format` recipes in
other vig-os npm repos (`sync-issues-action`) carry the same glob.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 02:58 PM_

Done — shipped to `dev` in #75.

## What was fixed

- ✅ **The globs.** `eslint src` / `prettier --write src` — the tools now expand their own `**` instead of relying on `sh`, which has no globstar. eslint checks **6 files instead of 1**.
- ✅ **The two production findings.** `preserve-caught-error` in `commit-runner.ts` (the `execSync` cause was being discarded on rethrow) and `no-useless-assignment` in `commit.ts`. Neither was a correctness bug, exactly as the issue predicted. Dropping the dead `bytesRead` initializer also lets the compiler's definite-assignment analysis *prove* the read is safe, rather than us asserting it.
- ✅ **The whole-tree prettier reformat**, as its own reviewable commit.

## Corrections to the issue's premises

**The `src/__tests__` rule override is no longer needed.** The ~25 `no-require-imports` findings are gone: the ESM migration (#58) removed `require()` from the test suite entirely. The 46-finding triage collapsed to the two production findings above.

**The reformat is not cosmetic drift — it is the repo's own config finally being applied.** `.prettierrc` has always declared `singleQuote: true` / `printWidth: 100`, while the source is entirely double-quoted at ~80 cols, precisely *because* `format` never reached it. So most of the ~609/765-line diff is the resulting quote flip and re-wrapping.

**The broken glob was never the whole bug — nothing ran these tools at all.** The scaffold-managed `ci.yml` "Lint & Format" job runs only `just precommit` (the prek hook suite), which contains no JS linter or formatter. That is *why* the globs survived for the life of the repo, and why fixing the scripts alone would have let them rot again identically.

So #75 also adds a consumer-owned **`js-quality`** workflow (a separate file — `ci.yml` is managed and must not be edited, same arrangement as `dist-check.yml`) gating every PR on `just lint` and a new read-only `just format-check`. Same recipes a developer runs locally, so a green CI means a green tree.

## Verification

- The new gate ran on the PR and genuinely executed the tools — `eslint src`, then `prettier --check src` → `All matched files use Prettier code style!`. Not a vacuous pass.
- `E2E Smoke` passed, so the rebuilt bundle still performs a real signed commit against the live API — the reformat and both source fixes are verified end to end, not on faith.
- 84/84 tests, 0 `tsc` errors, `just precommit` green.

Closing (merged to `dev`, so it will not auto-close until release).

