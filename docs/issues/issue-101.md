---
type: issue
state: open
created: 2026-07-16T16:50:28Z
updated: 2026-07-16T16:50:28Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/101
comments: 0
labels: none
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-16T17:18:51.025Z
---

# [Issue 101]: [chore: hold typescript major (v7) in Renovate until toolchain supports it](https://github.com/vig-os/commit-action/issues/101)

TypeScript 7 (the native/Go compiler port) is not yet supported by our test/lint toolchain:

- `ts-jest@29` peer: `typescript >=4.3 <7`
- `typescript-eslint@8` peer: `typescript >=4.8.4 <6.1.0`

Renovate PR #99 (`typescript ^5.3.2 → ^7.0.0`) failed CI because of this (plus an out-of-sync lockfile breaking `npm ci`). #99 is closed.

Add a Renovate `packageRules` entry to hold the `typescript` major until both peers ship TS 7-compatible releases, then bump all three together in a single coordinated PR.
