---
type: issue
state: closed
created: 2026-07-14T11:25:04Z
updated: 2026-07-14T11:30:49Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/71
comments: 2
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:28.971Z
---

# [Issue 71]: [[TASK] Scope Dist Check to the release boundary — drop it from dev PRs](https://github.com/vig-os/commit-action/issues/71)

Follow-up to #59. Dist Check currently runs on every PR to dev, which makes Renovate runtime-dep bumps fail until someone rebuilds the bundle in-PR — friction with no payoff, since nothing ships from dev (no consumer pins @main/@dev; only tags ship, and those are guarded).

Change:
1. `dist-check.yml`: drop `dev` from the pull_request branches; keep `release/**` and `main`.
2. Dev protection ruleset: required checks back to `CI Summary` only.
3. Amend the Unreleased changelog entry to match.

Consequence, by design: dev may go stale; staleness surfaces on the release/X.Y.Z → main draft PR right after prepare-release, fixed by a single bugfix PR to the release branch. `release-extension.yml`'s finalize-time verification remains the hard tag guarantee.

Refs: #59
---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 11:29 AM_

Done via #72, merged to dev. dist-check.yml now triggers only on PRs to release/** and main; Dev protection's required checks were reduced to CI Summary before the PR (verified: #72 went CLEAN with no Dist Check run). Renovate PRs to dev are unblocked.

---

# [Comment #2]() by [c-vigo]()

_Posted on July 14, 2026 at 11:30 AM_

Upstream follow-up filed: vig-os/devkit#1059 proposes a `prepare-release-extension.yml` hook (mutating counterpart to `release-extension.yml`, runs right after the release branch is cut). Once it ships, this repo's extension would rebuild `dist/index.js` on the fresh release branch and commit it via commit-action itself — removing the manual bugfix-PR flow this issue accepted, with Dist Check on the release PR demoted to pure verification.

