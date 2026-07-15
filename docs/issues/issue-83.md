---
type: issue
state: open
created: 2026-07-15T13:19:41Z
updated: 2026-07-15T13:25:10Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/83
comments: 0
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:11.883Z
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
