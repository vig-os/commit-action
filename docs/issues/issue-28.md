---
type: issue
state: closed
created: 2026-03-27T10:14:36Z
updated: 2026-07-14T07:43:24Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/28
comments: 1
labels: none
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:36.104Z
---

# [Issue 28]: [Migrate GitHub Action from Node.js 20 before runner deprecation](https://github.com/vig-os/commit-action/issues/28)

## Context

GitHub is deprecating Node.js 20 on Actions runners: Node.js 24 becomes default 2026-06-02; Node.js 20 removed 2026-09-16. See https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

## Scope

Update `action.yml` (and any workflow that pins Node) to use Node 24, run tests, and tag a release so downstream repos (e.g. `vig-os/devcontainer` workflows using `vig-os/commit-action`) stay compatible.

## References

- Surfaced during RCA for [vig-os/devcontainer#453](https://github.com/vig-os/devcontainer/issues/453)
---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 07:43 AM_

Duplicate of #14 — same Node 20→24 runtime migration. Consolidating there; #14 now carries the release-for-downstream note from this issue. Closing as duplicate.

