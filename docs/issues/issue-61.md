---
type: issue
state: closed
created: 2026-07-14T09:08:56Z
updated: 2026-07-14T09:41:35Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/61
comments: 1
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:32.202Z
---

# [Issue 61]: [[BUG] CodeQL push trigger still filters on **.py — TypeScript pushes to main are never analyzed](https://github.com/vig-os/commit-action/issues/61)

## Description

`codeql.yml`'s `push` trigger still carries the Python scaffold's path filter, so post-merge CodeQL analysis on `main` never fires for the code this repo actually ships.

## Steps to Reproduce

1. Read `.github/workflows/codeql.yml:20-25`:

   ```yaml
   push:
     branches:
       - main
     paths:
       - '**.py'
       - '.github/workflows/**'
   ```

2. Note the analysis matrix is `['javascript-typescript', 'actions']` (:44) — commit `cf5e93f` switched the language but left the path filter.
3. Merge any `src/*.ts` / `dist/` change to `main`: no CodeQL push run is triggered.

## Expected Behavior

Pushes to `main` touching TypeScript source (or the bundle, or dependency manifests) trigger post-merge analysis, as the header comment (:9, "Pushes to main (post-merge analysis)") promises.

## Actual Behavior

Push-triggered analysis only fires for workflow-file changes. There are no `.py` files in the repo. The weekly schedule (:27) partially compensates, with up to a week of latency.

## Possible Solution

Replace the filter with `'**.ts'`, `'**.js'`, `'package*.json'`, `'.github/workflows/**'` — or drop the `paths` filter entirely (the repo is small; an unconditional push run is cheap and simpler). Upstream angle: the scaffold's CodeQL workflow is Python-flavored by default; a language-aware scaffold (vig-os/devkit#1027, #1039) would fix this class at the source.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 09:41 AM_

Fixed by #67, merged to dev (4db0683). LOCAL FIX divergence from the scaffold documented in the workflow; upstream tracked by vig-os/devkit#1027 / vig-os/devkit#1039.

