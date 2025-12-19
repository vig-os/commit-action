import * as github from "@actions/github";
export interface CommitOptions {
    token: string;
    owner: string;
    repo: string;
    branch: string;
    message: string;
    filePaths: string[];
    baseSha?: string;
}
export interface CommitResult {
    commitSha: string;
    treeSha: string;
    filesCommitted: number;
}
/**
 * Creates a Git blob for a file via GitHub API
 */
export declare function createBlob(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, filePath: string): Promise<{
    sha: string;
    mode: "100644" | "100755";
}>;
/**
 * Creates a Git tree with updated files via GitHub API
 */
export declare function createTree(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, baseTreeSha: string, filePaths: string[]): Promise<string>;
/**
 * Creates a commit via GitHub API (automatically signed by GitHub)
 */
export declare function createCommit(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, treeSha: string, parentSha: string, message: string): Promise<string>;
/**
 * Updates a branch reference to point to a new commit
 */
export declare function updateBranch(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, branch: string, commitSha: string, force?: boolean): Promise<void>;
/**
 * Gets the current HEAD SHA and tree SHA for a branch
 */
export declare function getBranchInfo(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, branch: string): Promise<{
    sha: string;
    treeSha: string;
}>;
/**
 * Main function to commit changes via GitHub API
 * This is designed to be modular and reusable - can be used as a standalone action
 */
export declare function commitViaAPI(options: CommitOptions): Promise<CommitResult>;
//# sourceMappingURL=commit.d.ts.map