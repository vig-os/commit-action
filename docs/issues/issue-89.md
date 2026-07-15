---
type: issue
state: closed
created: 2026-07-15T14:32:07Z
updated: 2026-07-15T14:32:49Z
author: vig-os-release-app[bot]
author_url: https://github.com/vig-os-release-app[bot]
url: https://github.com/vig-os/commit-action/issues/89
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:11.262Z
---

# [Issue 89]: [Release 0.3.0 failed — automatic rollback](https://github.com/vig-os/commit-action/issues/89)

Release 0.3.0 failed during the automated release workflow.

**Workflow Run:** [View logs](https://github.com/vig-os/commit-action/actions/runs/29423806600)
**Release PR:** #78

**Automatic rollback attempted:**
- Release branch reset to pre-finalization state (best-effort)

**Tag status (forward-fix policy):**
- Release tags are not deleted by automation (workflow choice; GitHub immutable-release lock-in applies only after a release is **published** when that setting is enabled). If a tag was pushed before the failure, it remains on the remote.
- Use a new release candidate to validate fixes, then re-run the final release when ready.
- If a draft GitHub Release exists, manage it from the Releases UI; **publishing** locks the linked tag and assets when **immutable releases** are enabled.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 02:32 PM_

Forgot to approve PR

