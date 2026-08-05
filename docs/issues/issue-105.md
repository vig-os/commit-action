---
type: issue
state: closed
created: 2026-07-17T07:36:07Z
updated: 2026-07-17T08:01:23Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/105
comments: 1
labels: none
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-18T04:44:07.283Z
---

# [Issue 105]: [Adopt devkit 1.3.1](https://github.com/vig-os/commit-action/issues/105)

## Summary

Bump the vigOS devkit scaffold from **1.2.1 → 1.3.1** (direnv mode). This is a
re-scaffold via the devkit installer pinned at `1.3.1 --force`; all values
resolve from the existing `.vig-os` manifest (mode/identity preserved).

This bump spans the **1.3.0 gitignore migration**, so it is the live
verification of devkit fix vig-os/devkit#1145.

## Fixes delivered

- **vig-os/devkit#1145** — gitignore migration hardening: consumer-owned
  `.gitignore.project` must not accrue scaffold-committed filenames or stale
  cross-language junk; scaffold-committed files stay tracked.
- **vig-os/devkit#1142** — per-language CodeQL push `paths:` filter (Node globs
  `**.ts`/`**.js`/`**.mjs`/`**.cjs` + `.github/workflows/**`, no `**.py`).
- **vig-os/devkit#1144** — release-extension token ceiling: the `extension`
  caller job grants the seam ceiling `contents: read`, `packages: write`,
  `id-token: write`, `attestations: write`.

## Pins

- `.vig-os` `DEVKIT_VERSION=1.3.1`
- `flake.nix` `vigos.url = "github:vig-os/devkit?ref=1.3.1"`
- `flake.lock` re-locked to the 1.3.1 rev
---

# [Comment #1]() by [c-vigo]()

_Posted on July 17, 2026 at 08:01 AM_

Deployed via #106 (merged to dev). Devkit 1.3.1 adopted: pins consistent (.vig-os / flake ?ref=1.3.1 / lock @5cfbac30), fix signatures vig-os/devkit#1142/#1144/#1145 verified in the diff, CI fully green.

