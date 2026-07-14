import * as github from "@actions/github";
import * as fs from "fs";
import { withRetry, RetryConfig } from "./retry.js";

/**
 * Retry settings threaded into individual Octokit REST call sites so a transient
 * mid-batch failure retries only the failing call, not the whole multi-call
 * operation (avoids re-uploading blobs/trees). Omitting it disables retries.
 */
export interface RetryOptions {
  config: RetryConfig;
  logger?: (msg: string) => void;
}

/**
 * Runs an Octokit REST call, retrying only that call on transient errors when
 * `retry` is provided. Without `retry`, the call runs once (no wrapping).
 */
function callWithRetry<T>(
  fn: () => Promise<T>,
  retry?: RetryOptions
): Promise<T> {
  if (!retry) {
    return fn();
  }
  return withRetry(fn, retry.config, retry.logger);
}

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

/**
 * Approximate serialized-byte budget per createTree request. A chunk starts a
 * new request once adding an entry would exceed this. Kept conservatively well
 * under GitHub's ~100 MB request body limit so many large inline text files do
 * not produce an oversized payload. The count cap (TREE_ENTRY_CHUNK_SIZE) and
 * this byte cap apply together — whichever is hit first ends the chunk.
 */
export const TREE_ENTRY_BYTE_LIMIT = 6 * 1024 * 1024;

/**
 * Per-file size threshold (bytes) above which a text file's content is uploaded
 * via createBlob (base64) instead of inlined into the createTree payload. Large
 * inline content is the main driver of oversized requests; routing big files
 * through a dedicated blob keeps the tree request small.
 */
export const INLINE_CONTENT_SIZE_LIMIT = 1024 * 1024;

/** Returns true if the file appears binary (NUL in first 8 KiB), using pre-fetched stat. */
function isBinaryFromStat(filePath: string, stat: fs.Stats): boolean {
  if (stat.size === 0) {
    return false;
  }
  const toRead = Math.min(8192, stat.size);
  const buf = Buffer.alloc(toRead);
  const fd = fs.openSync(filePath, "r");
  let bytesRead: number;
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
  options?: CreateBlobOptions,
  retry?: RetryOptions
): Promise<{ sha: string; mode: "100644" | "100755" }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath);
  const base64Content = content.toString("base64");

  const { data: blob } = await callWithRetry(
    () =>
      octokit.rest.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: "base64",
      }),
    retry
  );

  const mode = options?.mode ?? getFileMode(filePath);

  return { sha: blob.sha, mode };
}

/**
 * Approximate serialized (UTF-8 JSON) byte size of a tree entry. Inline text
 * entries are dominated by their `content`; blob-sha entries are tiny. A fixed
 * overhead covers the surrounding JSON keys/quotes/braces so the estimate is a
 * safe over-approximation rather than an exact serialization.
 */
function estimateEntrySize(entry: TreeBlobEntry): number {
  const overhead = 64;
  const pathSize = Buffer.byteLength(entry.path, "utf-8");
  const payloadSize =
    "content" in entry
      ? Buffer.byteLength(entry.content, "utf-8")
      : Buffer.byteLength(entry.sha, "utf-8");
  return overhead + pathSize + payloadSize;
}

/**
 * Chains createTree calls when there are many entries (avoids huge payloads).
 * A new chunk begins whenever adding the next entry would exceed either the
 * entry-count cap (TREE_ENTRY_CHUNK_SIZE) or the approximate byte budget
 * (TREE_ENTRY_BYTE_LIMIT); whichever limit is reached first wins.
 */
async function createTreeChained(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  initialBaseTreeSha: string,
  entries: TreeBlobEntry[],
  retry?: RetryOptions
): Promise<string> {
  let baseTreeSha = initialBaseTreeSha;
  let chunk: TreeBlobEntry[] = [];
  let chunkBytes = 0;

  const flush = async (): Promise<void> => {
    if (chunk.length === 0) {
      return;
    }
    const { data: tree } = await callWithRetry(
      () =>
        octokit.rest.git.createTree({
          owner,
          repo,
          base_tree: baseTreeSha,
          tree: chunk,
        }),
      retry
    );
    baseTreeSha = tree.sha;
    chunk = [];
    chunkBytes = 0;
  };

  for (const entry of entries) {
    const entrySize = estimateEntrySize(entry);
    // Start a new chunk if the current one is full by count, or if adding this
    // entry would push it past the byte budget (unless the chunk is empty, so a
    // single oversized entry still makes progress).
    if (
      chunk.length >= TREE_ENTRY_CHUNK_SIZE ||
      (chunk.length > 0 && chunkBytes + entrySize > TREE_ENTRY_BYTE_LIMIT)
    ) {
      await flush();
    }
    chunk.push(entry);
    chunkBytes += entrySize;
  }
  await flush();

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
  filePaths: string[],
  retry?: RetryOptions
): Promise<string> {
  const treeEntries: TreeBlobEntry[] = [];

  for (const filePath of filePaths) {
    const stat = fs.statSync(filePath);
    const mode: "100644" | "100755" =
      stat.mode & 0o111 ? "100755" : "100644";
    const isBinary = isBinaryFromStat(filePath, stat);

    if (isBinary) {
      const result = await createBlob(
        octokit,
        owner,
        repo,
        filePath,
        { mode },
        retry
      );
      treeEntries.push({
        path: filePath,
        mode: result.mode,
        type: "blob" as const,
        sha: result.sha,
      });
      continue;
    }

    // Large text files are routed through createBlob (base64) rather than
    // inlined, to keep the createTree request body from growing unbounded.
    if (stat.size > INLINE_CONTENT_SIZE_LIMIT) {
      const result = await createBlob(
        octokit,
        owner,
        repo,
        filePath,
        { mode },
        retry
      );
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
      const result = await createBlob(
        octokit,
        owner,
        repo,
        filePath,
        { mode },
        retry
      );
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

  return createTreeChained(
    octokit,
    owner,
    repo,
    baseTreeSha,
    treeEntries,
    retry
  );
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
  // Retries are applied per Octokit call site inside createTree (createBlob /
  // chained createTree), so a transient mid-batch failure retries only the
  // failing call instead of re-running the whole multi-call operation.
  const newTreeSha =
    filePaths.length === 0
      ? baseTreeSha
      : await createTree(octokit, owner, repo, baseTreeSha, filePaths, {
          config: retryConfig,
          logger: log,
        });

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
