---
type: issue
state: closed
created: 2026-03-24T14:00:14Z
updated: 2026-07-14T08:21:04Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/24
comments: 0
labels: none
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:36.590Z
---

# [Issue 24]: [refactor: apply retry at individual API call sites inside createTree](https://github.com/vig-os/commit-action/issues/24)

## Context

Follow-up from [PR #23 review](https://github.com/vig-os/commit-action/pull/23#discussion_r2981751281): `commitViaAPI` wraps the entire `createTree(...)` call in `withRetry`. `createTree` can perform many REST calls (`createBlob`, chained `createTree`). A retry after a mid-way transient failure re-runs the whole operation and can re-upload blobs/trees, increasing API usage and rate-limit pressure.

## Proposal

Apply `withRetry` at individual Octokit REST call sites inside `createTree` and `createTreeChained` (or thread `RetryConfig` into helpers) instead of retrying the whole multi-call operation.

## Tradeoffs

- **Pro:** Finer-grained retries avoid redoing successful work after a failure late in the batch.
- **Con:** Requires threading retry config through internal helpers and more surface area for tests.

## Related

- Copilot review comment on `src/commit.ts` (coarse `createTree` wrap)

