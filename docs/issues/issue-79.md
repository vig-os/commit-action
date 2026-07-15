---
type: issue
state: closed
created: 2026-07-15T07:08:11Z
updated: 2026-07-15T12:33:11Z
author: vig-os-release-app[bot]
author_url: https://github.com/vig-os-release-app[bot]
url: https://github.com/vig-os/commit-action/issues/79
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:12.708Z
---

# [Issue 79]: [Release 0.3.0 failed — automatic rollback](https://github.com/vig-os/commit-action/issues/79)

Release 0.3.0 failed during the automated release workflow.

**Workflow Run:** [View logs](https://github.com/vig-os/commit-action/actions/runs/29396249943)
**Release PR:** #78

**Automatic rollback attempted:**
- Release branch reset to pre-finalization state (best-effort)

**Tag status (forward-fix policy):**
- Release tags are not deleted by automation (workflow choice; GitHub immutable-release lock-in applies only after a release is **published** when that setting is enabled). If a tag was pushed before the failure, it remains on the remote.
- Use a new release candidate to validate fixes, then re-run the final release when ready.
- If a draft GitHub Release exists, manage it from the Releases UI; **publishing** locks the linked tag and assets when **immutable releases** are enabled.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 12:33 PM_

Resolved by #80 (merged into `release/0.3.0`).

Root cause: the devkit-scaffolded `release-core.yml` applied the draft + approval gate to *every* release kind, so the release-candidate dispatch aborted against its still-draft PR. Adopting devkit `1.2.1` fixes it — the gate is now guarded behind `release_kind=final` (vig-os/devkit#1095).

The `v`-prefix + floating `v0`/`v0.X` tag scheme was also re-secured in `.vig-os` (the upgrade had silently reset it; filed upstream as vig-os/devkit#1116). 0.3.0 can now be re-run from the merged `release/0.3.0`.

