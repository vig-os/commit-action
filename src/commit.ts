import * as github from "@actions/github";
import * as fs from "fs";
import { withRetry } from "./retry";

export interface CommitOptions {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  filePaths: string[];
  allowEmpty?: boolean;
  baseSha?: string;
  /** Max API attempt count (default 1 = no retries). */
  maxAttempts?: number;
  /** Logger for retry messages (default: console.info). */
  logger?: (msg: string) => void;
  /** Base delay in ms for retry backoff (test tuning). */
  baseDelayMs?: number;
  /** Max delay cap in ms for retry backoff (test tuning). */
  maxDelayMs?: number;
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
export const TREE_ENTRY_CHUNK_SIZE = 100;

/** Returns true if the file appears binary (NUL in first 8 KiB), using pre-fetched stat. */
function isBinaryFromStat(filePath: string, stat: fs.Stats): boolean {
  if (stat.size === 0) {
    return false;
  }
  const toRead = Math.min(8192, stat.size);
  const buf = Buffer.alloc(toRead);
  const fd = fs.openSync(filePath, "r");
  let bytesRead = 0;
  try {
    bytesRead = fs.readSync(fd, buf, 0, toRead, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (bytesRead === 0) {
    return false;
  }
  return buf.subarray(0, bytesRead).includes(0);
}

/**
 * Returns true if the file appears binary (null byte in first 8 KiB), matching Git's heuristic.
 */
export function isBinaryFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  return isBinaryFromStat(filePath, stat);
}

/**
 * Git tree file mode from local file permissions.
 */
export function getFileMode(filePath: string): "100644" | "100755" {
  const stats = fs.statSync(filePath);
  return stats.mode & 0o111 ? "100755" : "100644";
}

/** Options for createBlob. */
export interface CreateBlobOptions {
  /** Pre-computed mode from stat; avoids redundant statSync. */
  mode?: "100644" | "100755";
}

type TreeBlobEntry =
  | {
      path: string;
      mode: "100644" | "100755";
      type: "blob";
      content: string;
    }
  | {
      path: string;
      mode: "100644" | "100755";
      type: "blob";
      sha: string;
    };

/**
 * Creates a Git blob for a file via GitHub API
 */
export async function createBlob(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  filePath: string,
  options?: CreateBlobOptions
): Promise<{ sha: string; mode: "100644" | "100755" }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath);
  const base64Content = content.toString("base64");

  const { data: blob } = await octokit.rest.git.createBlob({
    owner,
    repo,
    content: base64Content,
    encoding: "base64",
  });

  const mode = options?.mode ?? getFileMode(filePath);

  return { sha: blob.sha, mode };
}

/**
 * Chains createTree calls when there are many entries (avoids huge payloads).
 */
async function createTreeChained(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  initialBaseTreeSha: string,
  entries: TreeBlobEntry[]
): Promise<string> {
  let baseTreeSha = initialBaseTreeSha;
  for (let i = 0; i < entries.length; i += TREE_ENTRY_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + TREE_ENTRY_CHUNK_SIZE);
    const { data: tree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: chunk,
    });
    baseTreeSha = tree.sha;
  }
  return baseTreeSha;
}

/**
 * Creates a Git tree with updated files via GitHub API.
 * Text files use inline `content` (one fewer API call per file). Binary files use createBlob.
 */
export async function createTree(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  baseTreeSha: string,
  filePaths: string[]
): Promise<string> {
  const treeEntries: TreeBlobEntry[] = [];

  for (const filePath of filePaths) {
    const stat = fs.statSync(filePath);
    const mode: "100644" | "100755" =
      stat.mode & 0o111 ? "100755" : "100644";
    const isBinary = isBinaryFromStat(filePath, stat);

    if (isBinary) {
      const result = await createBlob(octokit, owner, repo, filePath, { mode });
      treeEntries.push({
        path: filePath,
        mode: result.mode,
        type: "blob" as const,
        sha: result.sha,
      });
      continue;
    }

    const raw = fs.readFileSync(filePath);
    try {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(raw);
      treeEntries.push({
        path: filePath,
        mode,
        type: "blob" as const,
        content,
      });
    } catch {
      const result = await createBlob(octokit, owner, repo, filePath, { mode });
      treeEntries.push({
        path: filePath,
        mode: result.mode,
        type: "blob" as const,
        sha: result.sha,
      });
    }
  }

  if (treeEntries.length === 0) {
    return baseTreeSha;
  }

  return createTreeChained(octokit, owner, repo, baseTreeSha, treeEntries);
}

/**
 * Creates a commit via GitHub API (automatically signed by GitHub)
 */
export async function createCommit(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  treeSha: string,
  parentSha: string,
  message: string
): Promise<string> {
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: treeSha,
    parents: [parentSha],
  });

  return commit.sha;
}

/**
 * Updates a branch reference to point to a new commit
 */
export async function updateBranch(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string,
  commitSha: string,
  force: boolean = false
): Promise<void> {
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitSha,
    force,
  });
}

/**
 * Gets the current HEAD SHA and tree SHA for a branch
 */
export async function getBranchInfo(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string
): Promise<{ sha: string; treeSha: string }> {
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const { data: commit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: ref.object.sha,
  });

  return {
    sha: ref.object.sha,
    treeSha: commit.tree.sha,
  };
}

/**
 * Main function to commit changes via GitHub API
 * This is designed to be modular and reusable - can be used as a standalone action
 */
export async function commitViaAPI(
  options: CommitOptions
): Promise<CommitResult> {
  const {
    token,
    owner,
    repo,
    branch,
    message,
    filePaths,
    allowEmpty,
    baseSha,
    maxAttempts = 1,
    logger,
    baseDelayMs,
    maxDelayMs,
  } = options;

  if (filePaths.length === 0 && !allowEmpty) {
    throw new Error("No files to commit");
  }

  const octokit = github.getOctokit(token);
  const retryConfig = {
    maxAttempts,
    ...(baseDelayMs !== undefined && { baseDelayMs }),
    ...(maxDelayMs !== undefined && { maxDelayMs }),
  };
  const log = logger ?? console.info;

  // Get branch info (SHA and tree SHA)
  let branchSha: string;
  let baseTreeSha: string;

  if (baseSha) {
    // Use provided base SHA
    branchSha = baseSha;
    const { data: commit } = await withRetry(
      () =>
        octokit.rest.git.getCommit({
          owner,
          repo,
          commit_sha: baseSha,
        }),
      retryConfig,
      log
    );
    baseTreeSha = commit.tree.sha;
  } else {
    // Fetch from branch
    const branchInfo = await withRetry(
      () => getBranchInfo(octokit, owner, repo, branch),
      retryConfig,
      log
    );
    branchSha = branchInfo.sha;
    baseTreeSha = branchInfo.treeSha;
  }

  // For empty commits, reuse parent tree SHA; otherwise create a new tree.
  const newTreeSha =
    filePaths.length === 0
      ? baseTreeSha
      : await withRetry(
          () => createTree(octokit, owner, repo, baseTreeSha, filePaths),
          retryConfig,
          log
        );

  // Create commit (automatically signed by GitHub)
  const commitSha = await withRetry(
    () =>
      createCommit(
        octokit,
        owner,
        repo,
        newTreeSha,
        branchSha,
        message
      ),
    retryConfig,
    log
  );

  // Update branch reference
  await withRetry(
    () => updateBranch(octokit, owner, repo, branch, commitSha, false),
    retryConfig,
    log
  );

  return {
    commitSha,
    treeSha: newTreeSha,
    filesCommitted: filePaths.length,
  };
}
