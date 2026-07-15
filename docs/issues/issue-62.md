---
type: issue
state: closed
created: 2026-07-14T09:08:57Z
updated: 2026-07-15T12:33:30Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/62
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:13.170Z
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

---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 12:33 PM_

Delivered. `DEVKIT_TAG_PREFIX=v` and `DEVKIT_FLOATING_TAGS=major,minor` are declared in `.vig-os`:

- adopted in #76 (devkit `1.2.0`, which shipped the blockers vig-os/devkit#1044 + vig-os/devkit#1045), and
- re-secured in #80 (devkit `1.2.1`) after an upgrade regression blanked them (filed upstream as vig-os/devkit#1116).

Consumers can now pin `@v0` (floating major), an exact `@vX.Y.Z`, or a SHA; the floating `v0`/`v0.X` tags move automatically at promote. Closing as complete.

