# Commit Action

A modular GitHub Action that commits changes via GitHub API, creating automatically signed commits that can bypass repository rulesets.

- **Repository:** [vig-os/commit-action](https://github.com/vig-os/commit-action)
- **Organization:** [vigOS](https://github.com/vig-os)

## Features

- **Automatically signed commits** - Commits created via GitHub API are signed by GitHub
- **Bypasses rulesets** - Uses GitHub API instead of git push, allowing to bypass branch protection rules
- **Modular design** - Can be used as a standalone action or imported as a module
- **Type-safe** - Written in TypeScript with full type safety
- **Well tested** - Comprehensive unit test coverage

## Usage

### As a GitHub Action (prebuilt bundle)

```yaml
- name: Commit and push changes via API
  uses: vig-os/commit-action@v0.1.3
  env:
    GITHUB_TOKEN: ${{ steps.sync.outputs.app-token || steps.sync.outputs.github-token }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    TARGET_BRANCH: refs/heads/main  # Preferred: avoids conflicts with built-in GITHUB_REF
    # OR use GITHUB_REF: refs/heads/main (may be overridden by workflow context)
    COMMIT_MESSAGE: "chore: sync issues and PRs"
    FILE_PATHS: ${{ steps.sync.outputs.modified-files || 'docs' }}
```

### As a CLI Script

```bash
npm run commit
```

**Environment variables:**
- `GITHUB_TOKEN` or `GH_TOKEN` - GitHub token (app token or regular token)
- `GITHUB_REPOSITORY` - Repository in format "owner/repo" (defaults to context)
- `TARGET_BRANCH` - **Preferred**: Branch reference (e.g., "refs/heads/main" or just "main", defaults to workflow context)
- `GITHUB_REF` - Alternative branch reference (may conflict with GitHub's built-in variable if workflow runs on different branch)
- `COMMIT_MESSAGE` - Commit message (defaults to "chore: update files")
- `FILE_PATHS` - Comma-separated list of file paths or directories (or auto-detects from git status)
- `BASE_SHA` - Optional base commit SHA (defaults to branch HEAD)

**Note:** Use `TARGET_BRANCH` instead of `GITHUB_REF` to avoid conflicts when your workflow runs on a different branch than the target commit branch. GitHub Actions sets `GITHUB_REF` automatically based on the workflow trigger, which can override your explicit setting.

### As a Module

```typescript
import { commitViaAPI } from './src/commit';

const result = await commitViaAPI({
  token: 'your-token',
  owner: 'owner',
  repo: 'repo',
  branch: 'dev',
  message: 'chore: update files',
  filePaths: ['file1.txt', 'file2.txt'],
});

console.log(`Committed ${result.commitSha}`);
```

## API

### `commitViaAPI(options: CommitOptions): Promise<CommitResult>`

Main function to commit changes via GitHub API.

**Options:**
- `token: string` - GitHub token
- `owner: string` - Repository owner
- `repo: string` - Repository name
- `branch: string` - Branch name
- `message: string` - Commit message
- `filePaths: string[]` - Array of file paths to commit
- `baseSha?: string` - Optional base commit SHA

**Returns:**
- `commitSha: string` - SHA of the created commit
- `treeSha: string` - SHA of the created tree
- `filesCommitted: number` - Number of files committed

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Bundle for Actions (outputs to dist/index.js)
npm run bundle

# Run commit script
npm run commit
```

## License

See [LICENSE](./LICENSE).
