# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

### Changed

### Removed

### Fixed

### Security

## [v0.1.0] - 2025-12-17

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

[0.1.0]: https://github.com/vig-os/commit-action/releases/tag/v0.1.0
