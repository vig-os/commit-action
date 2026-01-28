/**
 * CLI runner for commit module
 * Reads environment variables and commits changes via GitHub API
 *
 * Environment variables:
 * - GITHUB_TOKEN: GitHub token (app token or regular token)
 * - GITHUB_REPOSITORY: Repository in format "owner/repo"
 * - GITHUB_REF or TARGET_BRANCH: Branch reference (e.g., "refs/heads/dev" or just "dev")
 * - COMMIT_MESSAGE: Commit message
 * - FILE_PATHS: Comma-separated list of file paths to commit (or read from git status)
 */
/**
 * Normalizes a Git reference to a branch name
 * @param ref - Git reference (e.g., "refs/heads/main", "refs/tags/v1.0.0", or just "main")
 * @returns Normalized branch/tag name
 */
export declare function normalizeBranch(ref: string): string;
/**
 * Resolves the target branch from environment variables and context
 * Priority: TARGET_BRANCH > GITHUB_REF (if different from context) > context.ref
 * @param options - Branch resolution options
 * @returns Resolved branch name
 */
export declare function resolveBranch(options: {
    targetBranch?: string;
    githubRef?: string;
    contextRef: string;
}): string;
//# sourceMappingURL=commit-runner.d.ts.map