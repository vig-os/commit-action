---
type: issue
state: closed
created: 2026-06-29T07:56:30Z
updated: 2026-07-14T07:34:11Z
author: c-vigo
author_url: https://github.com/c-vigo
url: https://github.com/vig-os/commit-action/issues/30
comments: 0
labels: bug
assignees: none
milestone: none
projects: none
parent: none
children: none
synced: 2026-07-15T04:46:35.227Z
---

# [Issue 30]: [[BUG] post-create.sh masks failures (false 'tsx installed') and assumes apt/Debian base — breaks on Nix devcontainer](https://github.com/vig-os/commit-action/issues/30)

## Description

Found while live-testing the vigOS devcontainer **Nix migration** (vig-os/devcontainer `feature/625-nix-claude-migration`) against this repo. Two related problems in `.devcontainer/scripts/post-create.sh`:

1. **Silent failure / false success.** The tsx step runs `npm install -g tsx >/dev/null 2>&1` and then reports `tsx installed (<version>)` using a version probe that falls back to `""` on failure. On the new image the global install lands in an off-`PATH` location (see vig-os/devcontainer#728), so `tsx` is **not actually available**, yet the script prints `tsx installed ()` and exits 0. Failures are masked.

2. **Assumes a Debian/apt base.** The Node.js install path uses `apt-get` / `deb.nodesource.com`. The migrated image is hermetic Nix with **no apt** (and Node is already baked in). The `command -v node` guard happens to skip apt here, but the script is not portable to the new base and would break if the guard ever falls through.

## Steps to Reproduce

1. Point `.devcontainer/docker-compose.yml` at the Nix image (`ghcr.io/vig-os/devcontainer:dev`).
2. Start the container and run `.devcontainer/scripts/post-create.sh`.
3. Observe `tsx installed ()` (empty version) and exit 0, but `command -v tsx` → not found.

## Expected Behavior

`post-create.sh` fails loudly if a required tool (tsx) isn't actually installed/available, and does not assume `apt`.

## Actual Behavior

Errors are swallowed; the script reports success while `tsx` is missing. The build/test pipeline itself (`npm ci && npm run build && npm test`, 80/80) passes on the Nix image **once `/usr/bin/env` exists** (vig-os/devcontainer#727).

## Environment

- **OS**: NixOS (host)
- **Container Runtime**: Podman 5.8.2
- **Image Version/Tag**: `ghcr.io/vig-os/devcontainer:dev` (Nix migration branch)
- **Architecture**: AMD64

## Additional Context

- Upstream image fixes filed: vig-os/devcontainer#727 (`/usr/bin/env`), #728 (npm global prefix off-PATH).
- Node 24 runtime work already tracked here in #14 / #28; devcontainer bump in #29.

## Possible Solution

- Stop swallowing output: drop `>/dev/null 2>&1`, check the actual exit code, and verify `command -v tsx` after install (fail otherwise).
- Prefer `npx tsx` (local) over a global install, or set a writable on-`PATH` npm prefix.
- Remove the apt/NodeSource path (rely on the baked Node toolchain) once the devcontainer bump (#29) lands.

