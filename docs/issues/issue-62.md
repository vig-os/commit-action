---
type: issue
state: open
created: 2026-07-14T09:08:57Z
updated: 2026-07-14T09:08:57Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/62
comments: 0
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:31.532Z
---

# [Issue 62]: [[TASK] Adopt DEVKIT_TAG_PREFIX=v and floating major/minor tags once devkit ships them](https://github.com/vig-os/commit-action/issues/62)

## Description

Adopt the per-repo tag scheme in the devkit release pipeline once devkit ships it, restoring this repo's `v`-prefixed tagging (`v0.3.0`) and automating the floating tags (`v0`, `v0.3`) that are currently moved by hand.

**Blocked on:** vig-os/devkit#1044 (`DEVKIT_TAG_PREFIX`) and vig-os/devkit#1045 (`DEVKIT_FLOATING_TAGS`) landing in a devkit release.

## Work in this repo once unblocked

1. Bump `DEVKIT_VERSION` in `.vig-os` to the devkit release carrying #1044/#1045 and re-scaffold.
2. Declare the scheme in `.vig-os`:

   ```ini
   DEVKIT_TAG_PREFIX=v
   DEVKIT_FLOATING_TAGS=major,minor
   ```

3. Update `README.md` usage/pinning guidance: recommend `@v0` (floating major) or an exact `@vX.Y.Z` / SHA pin; drop the "pin `@main`" note (:35) once the next release ships the current `main` features.
4. Verify on the first release through the pipeline: tag `vX.Y.Z` pushed, changelog heading `## [vX.Y.Z](…/releases/tag/vX.Y.Z) - DATE` continuous with existing entries, `v0`/`v0.X` moved at promote, release link resolves.

## Why blocked rather than local-fixed

The tag naming is spread across four scaffold-managed workflows (`release-core`, `release-publish`, `prepare-release`, `promote-release`) plus `prepare-changelog`; patching locally means drift re-applied on every devkit upgrade. The interim position: hold releases through the pipeline until the prefix ships (or, if one is urgent, tag manually after promote in the historical `v`-scheme and note it in the release).

