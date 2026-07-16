---
type: issue
state: closed
created: 2026-07-15T13:19:41Z
updated: 2026-07-15T16:08:42Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/83
comments: 1
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-16T04:56:01.339Z
---

# [Issue 83]: [Remove vestigial CODEOWNERS template](https://github.com/vig-os/commit-action/issues/83)

## Problem

`.github/CODEOWNERS` is the devkit template with every rule commented out, so it matches no
files. OpenSSF Scorecard flags the repo under its Branch-Protection check (code scanning
alert #1), partly because code-owner review is not effective.

## Decision

Remove the file entirely instead of populating it: this is a sole-maintainer repo, and
GitHub forbids self-approval, so real CODEOWNERS entries would block the maintainer's own
PRs behind a review nobody can provide. The remaining Scorecard warnings are covered by the
branch rulesets updated on 2026-07-14 (required PR, 1 approving review on `main`, required
status checks, signed commits); the codeowners warning is accepted.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 04:08 PM_

Resolved by #84 (`chore(github): remove vestigial CODEOWNERS template`), now on `main` and propagated to `dev` via sync-main-to-dev ([run 29430880022](https://github.com/vig-os/commit-action/actions/runs/29430880022)). Closing.

