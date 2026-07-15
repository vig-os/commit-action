---
type: issue
state: closed
created: 2026-07-14T09:37:54Z
updated: 2026-07-14T14:29:42Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/70
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:29.452Z
---

# [Issue 70]: [[TASK] Remove accidentally committed tsc byproducts under dist/src/ and fix the .gitignore rule](https://github.com/vig-os/commit-action/issues/70)

Found while implementing #59: `dist/` tracks 32 tsc declaration byproducts under `dist/src/**` in addition to the real artifact `dist/index.js`. The `.gitignore` rule `dist/__tests__` never matched the actual `dist/src/__tests__` path (the tree's own comment says only `dist/index.js` is meant to be committed).

The `.d.ts.map` files embed absolute `file://` source paths, so `just bundle` regenerates them differently at every checkout location — which is why the #59 freshness gate is scoped to `dist/index.js` instead of `dist/`.

Work:
1. `git rm -r` the `dist/src/**` byproducts.
2. Fix the `.gitignore` rule (`dist/__tests__` → `dist/src`, or ignore `dist/*` and un-ignore `dist/index.js`).
3. Then broaden both freshness gates (`dist-check.yml`, `release-extension.yml`) from `dist/index.js` to `dist/` for full-tree determinism.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 02:29 PM_

Done — shipped to `dev` in #73 (`3b288b1`).

- ✅ 1. `git rm -r dist/src` — the 32 byproducts are untracked; `git ls-files dist/` is now just the real artifacts.
- ✅ 2. `.gitignore` rule fixed: dead `dist/__tests__` → `dist/*` with `!dist/index.js` re-admitted (and `!dist/package.json` added in #74, once ncc began emitting it for the ESM bundle).
- ✅ 3. Both gates (`dist-check.yml`, `release-extension.yml`) broadened from `dist/index.js` to the whole `dist/` tree.

Two corrections to the issue's premises, for the record:

- The byproducts are **not only a `tsc` artifact** — `ncc` emits them too, honoring the same `tsconfig` `outDir`/`declaration` settings. A plain `just bundle` regenerates all 17 of them, so the ignore rule had to cover the bundle path, not just `npm run build`.
- The gates now test `git status --porcelain -- dist/` rather than `git diff --exit-code`. `git diff` only sees *tracked* files, so build output that ncc starts emitting but nobody commits would slip through silently — which is exactly what happened in #74, when ncc began emitting `dist/package.json`.

Verified in a clean clone: no false positive after a rebuild, still fails on real source drift, and now catches the emitted-but-untracked case.

Closing (merged to `dev`, so it will not auto-close until release).

