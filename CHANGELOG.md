# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.5](https://github.com/vig-os/commit-action/releases/tag/v0.1.5) - 2026-03-13

### Fixed

- Excluded `.git` metadata paths during `FILE_PATHS` directory expansion to prevent malformed Git tree paths (issue #15).

## [v0.1.4](https://github.com/vig-os/commit-action/releases/tag/v0.1.4) - 2026-03-11

### Added

- Added `ALLOW_EMPTY` environment variable support to allow creating signed empty commits when no file changes are detected
- Added unit test coverage for empty commit behavior in `commitViaAPI()` and `commit-runner` flow handling

### Changed

- Updated npm dependency overrides to force patched `minimatch` versions across transitive dependency trees.
- Updated `commitViaAPI()` to support empty commits by reusing the parent tree SHA when `ALLOW_EMPTY=true`
- Updated runner behavior to preserve default no-op behavior when no files are detected, unless `ALLOW_EMPTY=true`
- Updated README usage examples and environment variable documentation for `ALLOW_EMPTY`
- Replaced `process.exit(0)` with early return in runner for improved testability

### Fixed

- Fixed missing `ALLOW_EMPTY` in commit-runner environment variable documentation

### Security

- Fixed `minimatch` ReDoS vulnerabilities (`CVE-2026-27903` / `GHSA-7r86-cg39-jmmj`) by pinning safe transitive versions via npm overrides.

## [v0.1.3](https://github.com/vig-os/commit-action/releases/tag/v0.1.3) - 2026-01-28

### Added

- Added `TARGET_BRANCH` environment variable support to avoid conflicts with GitHub's built-in `GITHUB_REF`
- Added `normalizeBranch()` and `resolveBranch()` exported functions for branch resolution logic
- Added comprehensive test suite for branch normalization and resolution (`commit-runner.test.ts`)

### Changed

- Improved branch resolution logic with explicit priority: `TARGET_BRANCH` > `GITHUB_REF` (if different from context) > workflow context
- Refactored branch resolution into testable exported functions

### Fixed

- Fixed Jest test failures by adding manual mock for `@actions/github` ESM module
- Fixed npm audit vulnerabilities by adding package overrides for `@actions/http-client@3.0.2` and `undici@6.23.0`

### Security

- Fixed moderate severity vulnerability in `undici` package (<6.23.0) by forcing upgrade via npm overrides

## [v0.1.1](https://github.com/vig-os/commit-action/releases/tag/v0.1.1) - 2025-12-19

### Changed

- Updated pull request template testing instructions to use `npm test` instead of Makefile commands
- Updated README with repository and organization links for better visibility

### Removed

- Removed outdated test options from pull request template (image tests, integration tests, registry tests)

### Fixed

- Fixed action execution by bundling code and updating .gitignore to exclude dist directory


## [v0.1.0](https://github.com/vig-os/commit-action/releases/tag/v0.1.0) - 2025-12-17

### Added

- Initial release of Commit Action
- Core `commitViaAPI()` function for creating commits via GitHub API
- Automatic commit signing through GitHub API
- Support for bypassing repository rulesets via API commits
- CLI runner (`commit-runner.ts`) with environment variable configuration
- Modular TypeScript implementation for reusability
- Support for both individual files and directories in `FILE_PATHS`
- Automatic file expansion for directories
- Git status auto-detection when `FILE_PATHS` is not provided
- GitHub Actions integration with `action.yml`
- Comprehensive unit test suite with Jest
- TypeScript type definitions and interfaces (`CommitOptions`, `CommitResult`)
- Helper functions: `createBlob`, `createTree`, `createCommit`, `updateBranch`, `getBranchInfo`
- Support for preserving file permissions (regular files and executables)
- Base64 encoding for file content
- Bundled distribution with ncc for GitHub Actions
