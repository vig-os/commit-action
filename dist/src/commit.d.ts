import * as github from "@actions/github";
export interface CommitOptions {
    token: string;
    owner: string;
    repo: string;
    branch: string;
    message: string;
    filePaths: string[];
    allowEmpty?: boolean;
    baseSha?: string;
}
export interface CommitResult {
    commitSha: string;
    treeSha: string;
    filesCommitted: number;
}
/**
 * Max tree entries per createTree request. Keeps payloads comfortably under
 * GitHub's ~25 MB request body limit and avoids slow single-call responses.
 */
export declare const TREE_ENTRY_CHUNK_SIZE = 100;
/**
 * Returns true if the file appears binary (null byte in first 8 KiB), matching Git's heuristic.
 */
export declare function isBinaryFile(filePath: string): boolean;
/**
 * Git tree file mode from local file permissions.
 */
export declare function getFileMode(filePath: string): "100644" | "100755";
/** Options for createBlob. */
export interface CreateBlobOptions {
    /** Pre-computed mode from stat; avoids redundant statSync. */
    mode?: "100644" | "100755";
}
/**
 * Creates a Git blob for a file via GitHub API
 */
export declare function createBlob(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, filePath: string, options?: CreateBlobOptions): Promise<{
    sha: string;
    mode: "100644" | "100755";
}>;
/**
 * Creates a Git tree with updated files via GitHub API.
 * Text files use inline `content` (one fewer API call per file). Binary files use createBlob.
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