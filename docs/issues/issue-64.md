---
type: issue
state: closed
created: 2026-07-14T09:11:07Z
updated: 2026-07-14T09:21:05Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/64
comments: 1
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:30.397Z
---

# [Issue 64]: [Migrate ESLint to flat config and bump to v10](https://github.com/vig-os/commit-action/issues/64)

## Description

`eslint` v10 (#53) cannot land as a dependency bump. ESLint 9 made flat config
(`eslint.config.*`) the default; **ESLint 10 removed the legacy `.eslintrc` path
entirely**, and this repo still ships `.eslintrc.json`:

```
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
From ESLint v9.0.0, the default configuration file is now eslint.config.js.
```

`ESLINT_USE_FLAT_CONFIG=false` no longer works either — the escape hatch is gone in v10.

## Why it is unblocked now

Until #57 landed, there was a second, harder blocker: the pinned
`@typescript-eslint@6.21.0` hard-crashed under ESLint 10, because its bundled
`eslint-scope@7.x` produces a scope manager that ESLint 10's `SourceCode.finalize()`
no longer accepts:

```
TypeError: scopeManager.addGlobals is not a function
    at addDeclaredGlobals (eslint/lib/languages/js/source-code/source-code.js:221:15)
```

**#57 bumped `typescript-eslint` to `8.64.0`**, whose peer range is
`eslint: ^8.57.0 || ^9.0.0 || ^10.0.0`. So the plugin side is ready; only the config
format is left.

## Scope

- Migrate `.eslintrc.json` → flat config (`eslint.config.mjs`), preserving the current
  rule set exactly: `eslint:recommended` + `plugin:@typescript-eslint/recommended`,
  with `@typescript-eslint/no-explicit-any: warn` and
  `@typescript-eslint/explicit-function-return-type: off`, and the `node` / `es6` /
  `jest` environments (which become `globals` in flat config).
- Bump `eslint` `8.57` → `10.x`.
- No behavior change intended. Any new lint findings are from the
  `@typescript-eslint` 6 → 8 rule-set change that already landed in #57, and should be
  triaged explicitly rather than silently suppressed.

Node 24 (the dev-shell and the action runtime) satisfies ESLint 10's engines
(`^20.19.0 || ^22.13.0 || >=24`).

## Notes

Renovate's #53 is additionally DOA as-is: it bumped `package.json` without
regenerating `package-lock.json` (its own `npm install` hit the typescript-eslint 6
peer conflict), so `npm ci` fails before ESLint even runs —
`Invalid: lock file's eslint@8.57.1 does not satisfy eslint@10.7.0`. This issue
supersedes it.

## Related

- #53 — the Renovate PR this replaces
- #57 — landed `typescript-eslint` v8, the prerequisite

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 09:21 AM_

Done — implemented by **#65**, merged into `dev`.

`.eslintrc.json` is replaced by `eslint.config.mjs`, `eslint` is on v10, and `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` are consolidated into the `typescript-eslint` meta package (the canonical v8 flat-config entry point). The rule set is a faithful port — same base configs, same two overrides, and the `node`/`es6`/`jest` environments re-expressed as `languageOptions.globals`.

Verified before merge: `npx eslint src` lints all 8 source files with rules firing (confirmed with a negative control — an injected violation was caught, so the config is not silently linting nothing); `tsc` clean; 84/84 tests pass; full `prek` suite green.

Closing manually: #65 merged into `dev`, not the default branch, so GitHub's `Closes #64` keyword did not fire. That applies to every issue resolved by a PR into `dev` in this flow.

**Follow-up spun out of this work: #66** — `npm run lint` and `npm run format` only ever check one file, because `sh` has no globstar and `src/**/*.ts` collapses to `src/*/*.ts`. The production source has never been linted. That is pre-existing and deliberately not folded in here.

