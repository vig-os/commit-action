---
type: issue
state: closed
created: 2026-03-24T13:00:12Z
updated: 2026-07-14T08:25:44Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/22
comments: 0
labels: enhancement
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:37.067Z
---

# [Issue 22]: [Enhance createTree chunking: payload-size awareness and per-file threshold](https://github.com/vig-os/commit-action/issues/22)

## Summary

When creating trees with many text files,  chunks by entry count only (`TREE_ENTRY_CHUNK_SIZE = 100`). It does not account for total request payload size, which is dominated by inline `content` for text entries.

A chunk of 100 large text files could theoretically exceed GitHub's request body limits. Additionally, very large individual text files could be more safely handled via `createBlob` with base64 encoding than inlined.

## Proposed Enhancements

1. **Payload-size-aware chunking**: When building chunks, track approximate serialized size (bytes) and start a new chunk when approaching the limit (e.g., GitHub's ~100 MB request body limit).

2. **Per-file size threshold fallback**: For text files above a configurable size threshold (e.g., 1 MB), use `createBlob` with base64 instead of inline `content` to reduce risk of oversized requests and simplify chunking logic.

## Context

Raised in [PR #21](https://github.com/vig-os/commit-action/pull/21) Copilot review (comment on `createTreeChained`). Deferred from that PR because:
- Typical action payloads are small files
- Adds implementation complexity
- Low probability in current use cases

## Related

- PR #21 (createTree inline content optimization)
- Issue #19 (rate-limit friendliness)
