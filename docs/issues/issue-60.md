---
type: issue
state: closed
created: 2026-07-14T09:08:55Z
updated: 2026-07-14T09:40:45Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/60
comments: 2
labels: task
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:32.696Z
---

# [Issue 60]: [[TASK] Align branch/tag rulesets with devkit and enable immutable releases](https://github.com/vig-os/commit-action/issues/60)

## Description

Align this repo's rulesets with devkit's live protection model and enable immutable releases, so the dev → release/X.Y.Z → main flow is mechanism-enforced end to end.

## Current state vs devkit (live rulesets, compared 2026-07-14)

| Ruleset | devkit | commit-action | Action |
|---|---|---|---|
| Main protection | PR + 1 approval + code-owner review + required check `Test Summary`, non-FF, no deletion, **no bypass** | PR, non-FF, no deletion — **no required checks, no approval count, Integration bypass `always`** | Add required checks (`CI Summary`, `Dist Check`), 1 approving review, thread resolution; **remove the app bypass** (releases land via a normally-merged PR; nothing needs to push `main` directly) |
| Dev protection | PR (0 approvals) + required check, app bypass | **missing** | Create — the app bypass is required for `prepare-release`'s changelog-freeze commit to `dev` and the sync flow |
| Release protection (`release/*`) | PR (0 approvals) + required check, app bypass | **missing** | Create — bypass needed for release-branch creation and the finalize commit |
| Signed commits (~ALL) | required signatures | present | keep |
| Tag ruleset | none (policy via immutable releases + docs) | none | Create: deny tag create/update/delete for all actors, bypass = release app only. Covers release tags and makes future floating-tag moves (#62) app-exclusive |

Also enable **immutable releases** in repo settings (devkit policy: a published Release locks its tag + assets; recovery is forward-fix, never tag rewrite).

## Notes

- Required-check name differs from devkit: this repo's CI summary job is **`CI Summary`** (`ci.yml:157`), not `Test Summary`. `Dist Check` becomes required once #59 lands.
- The 1-approval rule on `main` works for a solo maintainer because release PRs are authored by the release app — the maintainer is an eligible reviewer.
- Apply via `gh api` and export the resulting JSONs (candidate home: `org-config`) so the same set can be replayed on `sync-issues-action`.

## Impact

Settings-only change, no code. Should land before the first release through the pipeline; the required-check additions depend on #59 existing first.

---

# [Comment #1]() by [c-vigo]()

_Posted on July 14, 2026 at 09:40 AM_

Applied 2026-07-14. Live state: **Dev protection** (18922479), **Release protection** (18922485), **Tag protection** (18922488) created; **Main protection** (11211130) updated in place; **Signed commits** (11211135) untouched. Immutable releases: already `{"enabled":true,"enforced_by_owner":true}` at the org level — nothing to enable.

Deviations from the issue text, both deliberate:

1. **Tag-ruleset bypass is `vig-os-release-app` (2930017), not the Integration id the issue implied.** `release-publish.yml` pushes tags with the release-app token (`release.yml` passes `secrets: inherit` and no `token` secret exists, so the app-token fallback is what authenticates). Bypassing only `commit-action-bot` (2433383) would have blocked every release at the tag push.
2. **`require_code_owner_review: true` is currently a no-op** — `.github/CODEOWNERS` exists but every owner line is commented out. Kept `true` to mirror devkit; it activates if/when a real owner line (e.g. `* @c-vigo`) is added.

Known friction until vig-os/devkit#1045 ships: the deny-all tag ruleset also blocks **manual** floating-tag moves (`v0`, `v0.2`). Options when the next release needs them: temporarily disable Tag protection, or add a repository-admin bypass actor. Left as-is per this issue's stated design.

Reproducible request bodies (usable for `sync-issues-action` with the check contexts and app ids adjusted):

<details><summary>dev-protection.json</summary>

```json
{
  "name": "Dev protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["refs/heads/dev"]
    }
  },
  "rules": [
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "dismissal_restriction": { "enabled": false, "allowed_actors": [] },
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge"]
      }
    },
    { "type": "deletion" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "CI Summary", "integration_id": 15368 },
          { "context": "Dist Check", "integration_id": 15368 }
        ]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 2433383, "actor_type": "Integration", "bypass_mode": "always" }
  ]
}
```
</details>

<details><summary>release-protection.json</summary>

```json
{
  "name": "Release protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["refs/heads/release/*"]
    }
  },
  "rules": [
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "dismissal_restriction": { "enabled": false, "allowed_actors": [] },
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "CI Summary", "integration_id": 15368 },
          { "context": "Dist Check", "integration_id": 15368 }
        ]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 2433383, "actor_type": "Integration", "bypass_mode": "always" }
  ]
}
```
</details>

<details><summary>main-protection.json</summary>

```json
{
  "name": "Main protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["refs/heads/main"]
    }
  },
  "rules": [
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "dismissal_restriction": { "enabled": false, "allowed_actors": [] },
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge"]
      }
    },
    { "type": "required_signatures" },
    { "type": "deletion" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "CI Summary", "integration_id": 15368 },
          { "context": "Dist Check", "integration_id": 15368 }
        ]
      }
    }
  ],
  "bypass_actors": []
}
```
</details>

<details><summary>tag-protection.json</summary>

```json
{
  "name": "Tag protection",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["~ALL"]
    }
  },
  "rules": [
    { "type": "creation" },
    { "type": "update" },
    { "type": "deletion" }
  ],
  "bypass_actors": [
    { "actor_id": 2930017, "actor_type": "Integration", "bypass_mode": "always" }
  ]
}
```
</details>



---

# [Comment #2]() by [c-vigo]()

_Posted on July 14, 2026 at 09:40 AM_

All rulesets applied and verified live; details above.

