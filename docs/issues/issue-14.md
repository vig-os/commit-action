---
type: issue
state: closed
created: 2026-03-12T08:07:29Z
updated: 2026-07-14T08:33:40Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/14
comments: 2
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:37.739Z
---

# [Issue 14]: [[TASK] Upgrade action to support Node.js 24 runtime](https://github.com/vig-os/commit-action/issues/14)

### Description

GitHub Actions is deprecating Node.js 20 runners. Starting June 2, 2026, actions will be forced to run with Node.js 24 by default.

This action is currently running on Node.js 20 and needs to be updated to support Node.js 24.

Reference: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

### Acceptance Criteria

- [ ] Update `action.yml` to use `node24` runtime
- [ ] Update dependencies for Node.js 24 compatibility
- [ ] Test action on Node.js 24
- [ ] Release new version with Node.js 24 support

### Implementation Notes

- Update `runs.using` in `action.yml` from `node20` to `node24`
- Run tests with Node.js 24 to identify breaking changes

### Priority

High
---

# [Comment #1]() by [c-vigo]()

_Posted on March 12, 2026 at 08:07 AM_

See also vig-os/sync-issues-action#77 — same Node.js 24 upgrade needed there. Resolution should be similar.

---

# [Comment #2]() by [c-vigo]()

_Posted on July 14, 2026 at 07:43 AM_

Consolidating the Node 20→24 runtime migration here (closing #28 as a duplicate). Carrying over #28's note: once `action.yml` is on `node24`, **tag a new release** so downstream consumers (e.g. `vig-os/devcontainer` workflows that use `vig-os/commit-action`) stay compatible before Node 20 is removed from runners on 2026-09-16.

