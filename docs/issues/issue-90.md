---
type: issue
state: closed
created: 2026-07-15T14:35:16Z
updated: 2026-07-15T15:22:13Z
author: vig-os-release-app[bot]
author_url: https://github.com/vig-os-release-app[bot]
url: https://github.com/vig-os/commit-action/issues/90
comments: 4
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T15:29:10.933Z
---

# [Issue 90]: [Release 0.3.0 failed — automatic rollback](https://github.com/vig-os/commit-action/issues/90)

Release 0.3.0 failed during the automated release workflow.

**Workflow Run:** [View logs](https://github.com/vig-os/commit-action/actions/runs/29423806600)
**Release PR:** #78

**Automatic rollback attempted:**
- Release branch reset to pre-finalization state (best-effort)

**Tag status (forward-fix policy):**
- Release tags are not deleted by automation (workflow choice; GitHub immutable-release lock-in applies only after a release is **published** when that setting is enabled). If a tag was pushed before the failure, it remains on the remote.
- Use a new release candidate to validate fixes, then re-run the final release when ready.
- If a draft GitHub Release exists, manage it from the Releases UI; **publishing** locks the linked tag and assets when **immutable releases** are enabled.
---

# [Comment #1]() by [c-vigo]()

_Posted on July 15, 2026 at 02:41 PM_

## Root cause analysis

**Failing job:** `Release Core / Finalize Release Core` → step **Build release artifact** → **exit 127** (command not found).

**Chain:**
```
just bundle  →  npm run bundle  →  ncc build src/commit-runner.ts -o dist
                                    sh: line 1: ncc: command not found
error: recipe `bundle` failed on line 85 with exit code 127
```

**Root cause:** `ncc` (`@vercel/ncc`) is a **devDependency** — it only exists at `node_modules/.bin/ncc` after `npm ci`. The finalize job installs the toolchain via `Set up devkit toolchain` (Nix dev-shell: provides `node`/`npm`, `uv`, `git`, `just`, …) but **never installs the repo's node deps**. So `npm run bundle` launches, prints `> commit-action@0.2.0 bundle`, then cannot find `ncc` and exits 127. The rollback job then fired.

**Why it slipped through:** the `Build release artifact` step (`just bundle`) was introduced on this branch by the devkit scaffold work in **vig-os/devkit#1029** (opt-in `dist/` rebuild for JS-Action consumers). CI (`ci.yml`) runs `just sync` (which is `npm ci` for Node repos) before any build, so `ncc` is present there; the scaffolded release finalize step omitted the equivalent install, so it only surfaces during a real `final` release.

**Fix (this repo, stopgap so 0.3.0 can proceed):** run `just sync` before `just bundle` in the `Build release artifact` step of `release-core.yml`. `just sync` is language-neutral (`uv sync` for Python, `npm ci` for Node) and the step is already gated on `has_bundle == 'true'`, so it only runs for repos that need the artifact build.

**Upstream:** `release-core.yml` is a **devkit-scaffolded** file (`.vig-os` → `DEVKIT_VERSION=1.1.0`); the local fix is a divergence that will be clobbered on the next re-scaffold. The durable fix belongs in the devkit scaffold template as a follow-up to vig-os/devkit#1029 — tracked in a new devkit issue.


---

# [Comment #2]() by [c-vigo]()

_Posted on July 15, 2026 at 02:46 PM_

Upstream (durable) fix tracked in vig-os/devkit#1130 — `release-core.yml` is devkit-scaffolded, so the local fix below is a stopgap that a re-scaffold will supersede once #1130 lands.

---

# [Comment #3]() by [c-vigo]()

_Posted on July 15, 2026 at 03:18 PM_

Stopgap fix up as #91 (into `release/0.3.0`). Upstream durable fix vig-os/devkit#1131 has **green CI** and is ready to merge into devkit `dev`. Once #91 lands, re-run the release on `release/0.3.0`.

---

# [Comment #4]() by [c-vigo]()

_Posted on July 15, 2026 at 03:22 PM_

## Resolved

**Root cause:** the `Finalize Release Core → Build release artifact` step ran `just bundle` (→ `npm run bundle` → `ncc`) without a preceding `just sync`, so `ncc` (a devDependency) was absent from PATH → exit 127 → rollback.

**Fixes merged:**
- **Stopgap (this repo):** #91 → `release/0.3.0` — adds `just sync` before `just bundle`. CI green (13 ✓ / 2 skipped). Lets 0.3.0 re-run without waiting for a re-scaffold.
- **Durable (upstream):** vig-os/devkit#1131 → devkit `dev` (closes devkit#1130) — same fix in the scaffold template, so every consumer gets it on the next `DEVKIT_VERSION` bump. CI green.

**Next step:** re-run the release on `release/0.3.0` (workflow_dispatch). When commit-action later bumps `DEVKIT_VERSION` to an image carrying #1131, the local stopgap in `release-core.yml` will be superseded by the re-scaffold and can be dropped.

Closing as fixed.

