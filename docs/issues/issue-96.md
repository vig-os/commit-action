---
type: issue
state: closed
created: 2026-07-15T16:50:28Z
updated: 2026-07-15T17:20:38Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/96
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-16T04:56:00.175Z
---

# [Issue 96]: [ci: smoke verify steps race the API — branch-head read can be stale right after the action commits](https://github.com/vig-os/commit-action/issues/96)

## Symptom

`published-tag-smoke` run [29433505922](https://github.com/vig-os/commit-action/actions/runs/29433505922) (dispatched from the #95 branch against `v0.3.0`) failed in *Verify the released action actually committed*:

```
Branch head b35ff1e8... != reported commit b62515ff...
```

The action had in fact succeeded: commit `b62515ff` exists, is signed (`verification.verified: true`, reason `valid`), has the correct parent (`b35ff1e`, the scratch-branch base) and the expected message. The verify step's `gh api .../commits/${SCRATCH_BRANCH}` ran ~1s after the action's `updateRef` and got the **stale** pre-commit head. An immediate re-dispatch ([29433677039](https://github.com/vig-os/commit-action/actions/runs/29433677039)) passed unchanged — classic read-after-write replication lag, not an action defect.

## Scope

Both smoke workflows share the pattern: `e2e-smoke.yml` and `published-tag-smoke.yml` read the scratch-branch head via the REST API immediately after the action returns. Either can flake the same way.

## Suggested fix

In both verify steps, poll the branch head for the reported `commit-sha` with a short bounded retry (e.g. up to 5 attempts, 3s apart) before declaring a mismatch. Keep the hard failure after the retry budget — the check must still catch a real no-op (the #58 class of bug it exists for).

Unrelated to the permission change in #94/#95 (a token problem would fail the action step itself, not the read).
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 05:20 PM_

Fixed in #97 (merged to `dev` as 5cc5801). Both smoke verify steps now poll the scratch-branch head for the reported `commit-sha` with a bounded retry (5 attempts, 3s apart) before failing, absorbing GitHub's read-after-write replication lag while keeping the hard failure that catches a genuine no-op.

