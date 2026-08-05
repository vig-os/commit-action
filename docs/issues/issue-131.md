---
type: issue
state: closed
created: 2026-08-05T09:04:23Z
updated: 2026-08-05T09:15:20Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/131
comments: 1
labels: documentation
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-08-05T09:41:14.484Z
---

# [Issue 131]: [docs(changelog): unreleased devkit 1.6.0 entry is stale after the flake pin advance (#126)](https://github.com/vig-os/commit-action/issues/131)

Two defects in the `## Unreleased` section of `CHANGELOG.md`, both about the
devkit 1.6.0 adoption. They must be fixed **before** the next
`prepare-release.yml` run, which freezes `## Unreleased` verbatim into the
released section — and released entries are never edited afterwards.

## 1. The 1.6.0 entry's flake-pin statement is stale

The **Adopt vigOS devkit 1.6.0** bullet (#121, #124) still reads:

> The `vigos` flake input stays on the scaffold's floating default (no `?ref`,
> as of 1.4.0 final), so the dev-shell toolchain tracks devkit's default branch
> rather than the pinned scaffold version; the dev shell reports the gap as a
> vig-os/devkit#1263 skew warning on load.

That was true when written, but #126 (`7c55618`) has since advanced
`flake.lock`'s `vigos` input from `26e291d` (the 1.5.1 release) to `ffa7a5f`
(the 1.6.0 release commit) via `nix flake update vigos`. The skew is resolved
and the warning no longer fires. Freezing the text as-is would ship a released
changelog that describes a condition the release does not have.

## 2. #126 has no changelog entry at all

The pin advance was merged as a bare `chore:` with no `## Unreleased` line, so
the lock movement is unrecorded.

## Acceptance criteria

- [ ] The 1.6.0 bullet describes the flake input's **final** state (locked to
      the 1.6.0 release commit, no skew warning)
- [ ] The pin advance (#126) is recorded
- [ ] No released section is touched

---

# [Comment #1]() by [c-vigo]()

_Posted on August 5, 2026 at 09:15 AM_

Resolved by #133 (merged as `7b0f4dc`).

The `## Unreleased` devkit 1.6.0 entry no longer claims the skew warning fires on shell entry, and now records the pin advance from #126 explicitly: the floating `vigos` input was locked at `26e291d` (1.5.1) after the pin-only adoption, and `nix flake update vigos` advanced it to `ffa7a5f`, the 1.6.0 release commit. The release therefore ships with pin and scaffold in lockstep.

