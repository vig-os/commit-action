---
type: issue
state: closed
created: 2026-07-14T09:08:58Z
updated: 2026-07-14T14:27:10Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/63
comments: 2
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:30.970Z
---

# [Issue 63]: [[TASK] Pre-release housekeeping: reconcile dev with main, prune release/0.2.0, metadata fixes](https://github.com/vig-os/commit-action/issues/63)

## Description

Housekeeping to put the repo in a clean state before the first release through the devkit pipeline.

## Items

1. **Reconcile `dev` with `main`.** `main` carries the node24 migration (#33 → `5e78fe4`, `002b549`) that `dev` lacks; the sync that should have carried it failed on the #36 checkout bug (fixed on `main` by #37, but `dev` never caught up). Re-dispatch `Sync main to dev` and let the sync PR land; verify `git rev-list --count origin/main ^origin/dev` is 0 afterwards.
2. **Delete the stale `release/0.2.0` branch.** Fully contained in `main` (0 commits ahead); the 0.2.0 release is long shipped. Keeping it around only trips the "release branch must not exist" validation if a future 0.2.x were ever prepared.
3. **Fix `action.yml` metadata.** `author` still says "Sync Issues Bot" (copy-paste from sync-issues-action).
4. **README touch-ups.** The usage example pins `@v0.1.5` (:23) while `v0.2.0` is the latest release; align the example with current guidance (full pinning-policy rewrite is deferred to the tag-scheme adoption issue).

## Notes

Items 1–2 are operational (workflow dispatch + branch deletion), 3–4 a small PR to `dev`. All independent of the devkit upstream work.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 09:37 AM_

Status:
- ✅ dev ⊇ main verified — the sync flow already carried node24 to dev (no re-dispatch needed).
- ✅ Metadata fixes merged to dev via #68 (action.yml author → vigOS, README pin → v0.2.0, obsolete @main note dropped).
- ⬜ **Remaining: delete the stale `release/0.2.0` branch.** Verified 0 commits ahead of main. The unattended session's permission mode blocked remote branch deletion; run manually:

  ```bash
  git push origin --delete release/0.2.0
  ```

Leaving the issue open for that one command.

---

# [Comment #2]() by [c-vigo]()

_Posted on July 14, 2026 at 02:27 PM_

All items complete.

- ✅ 1. `dev` ⊇ `main` — `git rev-list --count origin/main ^origin/dev` is 0.
- ✅ 2. `release/0.2.0` deleted — `git ls-remote --heads origin 'release/*'` returns nothing.
- ✅ 3–4. `action.yml` author and README pins fixed in #68 (`93ea2be`).

Closing.

