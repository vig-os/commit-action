---
type: issue
state: closed
created: 2026-07-17T14:41:54Z
updated: 2026-07-20T16:34:27Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/107
comments: 1
labels: none
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-21T05:16:33.816Z
---

# [Issue 107]: [Adopt devkit 1.4.0](https://github.com/vig-os/commit-action/issues/107)

## Summary

Bump the vigOS devkit scaffold from **1.3.1 → 1.4.0** (direnv mode). This is a
re-scaffold via the devkit installer, `--force` pinned at the release, with all
values resolved from the existing `.vig-os` manifest (mode/identity preserved).

This adoption **validates `1.4.0-rc2` ahead of the final `1.4.0` release** — the
PR pins `1.4.0-rc2` for CI validation and will be bumped to the final `1.4.0`
pins before merge.

## What 1.4.0 delivers (relevant to this consumer)

- **vig-os/devkit#1182 — zizmor workflow audit + baseline (Security):** the 14
  managed workflows are audited; 8 findings fixed upstream (`persist-credentials:
  false` on read-only checkouts, release-app token moved to `env:`), and a
  devkit-owned `zizmor.yml` baseline suppresses the intentional remainder so this
  consumer's own baseline stays at zero. A new `zizmor.yml` config arrives.
- **vig-os/devkit#1167 — direnv scaffolds default to flake-generated pre-commit
  hooks:** direnv consumers move off the hand-managed `.pre-commit-config.yaml`
  onto the shared flake hook set (host-side, drops the native `pymarkdown` hook
  that fails on the bare runner).
- **vig-os/devkit#1170 — pymarkdown packaged in the flake + promoted to a
  `language: system` hook** across all hook artifacts.
- **vig-os/devkit#1173 — `DEVKIT_CI_RUNNER` key** lets a consumer route managed
  `ci.yml` jobs to self-hosted runners (absent key ⇒ unchanged `ubuntu-24.04`).
- Opt-in-only additions with no effect here unless enabled: `docs` typst module
  (#1178), `gitleaks` hook (#1172), nix-language support / statix+deadnix (#1171).

## Pins (final)

- `.vig-os` `DEVKIT_VERSION=1.4.0`
- `flake.nix` `vigos.url = "github:vig-os/devkit?ref=1.4.0"`
- `flake.lock` re-locked to the 1.4.0 revision

Preserved from `.vig-os`: `DEVKIT_MODE=direnv`, `DEVKIT_TAG_PREFIX=v`,
`DEVKIT_FLOATING_TAGS=major,minor`.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 20, 2026 at 04:34 PM_

devkit 1.4.0 adopted via PR #108 (merged). Validated across rc5/rc6 and bumped to the final release with floating vigos input.

