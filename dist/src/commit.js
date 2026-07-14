"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.INLINE_CONTENT_SIZE_LIMIT = exports.TREE_ENTRY_BYTE_LIMIT = exports.TREE_ENTRY_CHUNK_SIZE = void 0;
exports.isBinaryFile = isBinaryFile;
exports.getFileMode = getFileMode;
exports.createBlob = createBlob;
exports.createTree = createTree;
exports.createCommit = createCommit;
exports.updateBranch = updateBranch;
exports.getBranchInfo = getBranchInfo;
exports.commitViaAPI = commitViaAPI;
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const retry_1 = require("./retry");
/**
 * Runs an Octokit REST call, retrying only that call on transient errors when
 * `retry` is provided. Without `retry`, the call runs once (no wrapping).
 */
function callWithRetry(fn, retry) {
    if (!retry) {
        return fn();
    }
    return (0, retry_1.withRetry)(fn, retry.config, retry.logger);
}
/**
 * Max tree entries per createTree request. Keeps payloads comfortably under
 * GitHub's ~25 MB request body limit and avoids slow single-call responses.
 */
exports.TREE_ENTRY_CHUNK_SIZE = 100;
/**
 * Approximate serialized-byte budget per createTree request. A chunk starts a
 * new request once adding an entry would exceed this. Kept conservatively well
 * under GitHub's ~100 MB request body limit so many large inline text files do
 * not produce an oversized payload. The count cap (TREE_ENTRY_CHUNK_SIZE) and
 * this byte cap apply together — whichever is hit first ends the chunk.
 */
exports.TREE_ENTRY_BYTE_LIMIT = 6 * 1024 * 1024;
/**
 * Per-file size threshold (bytes) above which a text file's content is uploaded
 * via createBlob (base64) instead of inlined into the createTree payload. Large
 * inline content is the main driver of oversized requests; routing big files
 * through a dedicated blob keeps the tree request small.
 */
exports.INLINE_CONTENT_SIZE_LIMIT = 1024 * 1024;
/** Returns true if the file appears binary (NUL in first 8 KiB), using pre-fetched stat. */
function isBinaryFromStat(filePath, stat) {
    if (stat.size === 0) {
        return false;
    }
    const toRead = Math.min(8192, stat.size);
    const buf = Buffer.alloc(toRead);
    const fd = fs.openSync(filePath, "r");
    let bytesRead = 0;
    try {
        bytesRead = fs.readSync(fd, buf, 0, toRead, 0);
    }
    finally {
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
function isBinaryFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    return isBinaryFromStat(filePath, stat);
}
/**
 * Git tree file mode from local file permissions.
 */
function getFileMode(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mode & 0o111 ? "100755" : "100644";
}
/**
 * Creates a Git blob for a file via GitHub API
 */
async function createBlob(octokit, owner, repo, filePath, options, retry) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath);
    const base64Content = content.toString("base64");
    const { data: blob } = await callWithRetry(() => octokit.rest.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: "base64",
    }), retry);
    const mode = options?.mode ?? getFileMode(filePath);
    return { sha: blob.sha, mode };
}
/**
 * Approximate serialized (UTF-8 JSON) byte size of a tree entry. Inline text
 * entries are dominated by their `content`; blob-sha entries are tiny. A fixed
 * overhead covers the surrounding JSON keys/quotes/braces so the estimate is a
 * safe over-approximation rather than an exact serialization.
 */
function estimateEntrySize(entry) {
    const overhead = 64;
    const pathSize = Buffer.byteLength(entry.path, "utf-8");
    const payloadSize = "content" in entry
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
async function createTreeChained(octokit, owner, repo, initialBaseTreeSha, entries, retry) {
    let baseTreeSha = initialBaseTreeSha;
    let chunk = [];
    let chunkBytes = 0;
    const flush = async () => {
        if (chunk.length === 0) {
            return;
        }
        const { data: tree } = await callWithRetry(() => octokit.rest.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: chunk,
        }), retry);
        baseTreeSha = tree.sha;
        chunk = [];
        chunkBytes = 0;
    };
    for (const entry of entries) {
        const entrySize = estimateEntrySize(entry);
        // Start a new chunk if the current one is full by count, or if adding this
        // entry would push it past the byte budget (unless the chunk is empty, so a
        // single oversized entry still makes progress).
        if (chunk.length >= exports.TREE_ENTRY_CHUNK_SIZE ||
            (chunk.length > 0 && chunkBytes + entrySize > exports.TREE_ENTRY_BYTE_LIMIT)) {
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
async function createTree(octokit, owner, repo, baseTreeSha, filePaths, retry) {
    const treeEntries = [];
    for (const filePath of filePaths) {
        const stat = fs.statSync(filePath);
        const mode = stat.mode & 0o111 ? "100755" : "100644";
        const isBinary = isBinaryFromStat(filePath, stat);
        if (isBinary) {
            const result = await createBlob(octokit, owner, repo, filePath, { mode }, retry);
            treeEntries.push({
                path: filePath,
                mode: result.mode,
                type: "blob",
                sha: result.sha,
            });
            continue;
        }
        // Large text files are routed through createBlob (base64) rather than
        // inlined, to keep the createTree request body from growing unbounded.
        if (stat.size > exports.INLINE_CONTENT_SIZE_LIMIT) {
            const result = await createBlob(octokit, owner, repo, filePath, { mode }, retry);
            treeEntries.push({
                path: filePath,
                mode: result.mode,
                type: "blob",
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
                type: "blob",
                content,
            });
        }
        catch {
            const result = await createBlob(octokit, owner, repo, filePath, { mode }, retry);
            treeEntries.push({
                path: filePath,
                mode: result.mode,
                type: "blob",
                sha: result.sha,
            });
        }
    }
    if (treeEntries.length === 0) {
        return baseTreeSha;
    }
    return createTreeChained(octokit, owner, repo, baseTreeSha, treeEntries, retry);
}
/**
 * Creates a commit via GitHub API (automatically signed by GitHub)
 */
async function createCommit(octokit, owner, repo, treeSha, parentSha, message) {
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
async function updateBranch(octokit, owner, repo, branch, commitSha, force = false) {
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
async function getBranchInfo(octokit, owner, repo, branch) {
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
async function commitViaAPI(options) {
    const { token, owner, repo, branch, message, filePaths, allowEmpty, baseSha, maxAttempts = 1, logger, baseDelayMs, maxDelayMs, } = options;
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
    let branchSha;
    let baseTreeSha;
    if (baseSha) {
        // Use provided base SHA
        branchSha = baseSha;
        const { data: commit } = await (0, retry_1.withRetry)(() => octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: baseSha,
        }), retryConfig, log);
        baseTreeSha = commit.tree.sha;
    }
    else {
        // Fetch from branch
        const branchInfo = await (0, retry_1.withRetry)(() => getBranchInfo(octokit, owner, repo, branch), retryConfig, log);
        branchSha = branchInfo.sha;
        baseTreeSha = branchInfo.treeSha;
    }
    // For empty commits, reuse parent tree SHA; otherwise create a new tree.
    // Retries are applied per Octokit call site inside createTree (createBlob /
    // chained createTree), so a transient mid-batch failure retries only the
    // failing call instead of re-running the whole multi-call operation.
    const newTreeSha = filePaths.length === 0
        ? baseTreeSha
        : await createTree(octokit, owner, repo, baseTreeSha, filePaths, {
            config: retryConfig,
            logger: log,
        });
    // Create commit (automatically signed by GitHub)
    const commitSha = await (0, retry_1.withRetry)(() => createCommit(octokit, owner, repo, newTreeSha, branchSha, message), retryConfig, log);
    // Update branch reference
    await (0, retry_1.withRetry)(() => updateBranch(octokit, owner, repo, branch, commitSha, false), retryConfig, log);
    return {
        commitSha,
        treeSha: newTreeSha,
        filesCommitted: filePaths.length,
    };
}
//# sourceMappingURL=commit.js.map