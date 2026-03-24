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
exports.TREE_ENTRY_CHUNK_SIZE = void 0;
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
/** Max tree entries per createTree request (payload / GitHub limits). */
exports.TREE_ENTRY_CHUNK_SIZE = 100;
/**
 * Returns true if the file appears binary (null byte in first 8 KiB), matching Git's heuristic.
 */
function isBinaryFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
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
 * Git tree file mode from local file permissions.
 */
function getFileMode(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mode & 0o111 ? "100755" : "100644";
}
/**
 * Creates a Git blob for a file via GitHub API
 */
async function createBlob(octokit, owner, repo, filePath) {
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
    const mode = getFileMode(filePath);
    return { sha: blob.sha, mode };
}
/**
 * Chains createTree calls when there are many entries (avoids huge payloads).
 */
async function createTreeChained(octokit, owner, repo, initialBaseTreeSha, entries) {
    let baseTreeSha = initialBaseTreeSha;
    for (let i = 0; i < entries.length; i += exports.TREE_ENTRY_CHUNK_SIZE) {
        const chunk = entries.slice(i, i + exports.TREE_ENTRY_CHUNK_SIZE);
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
async function createTree(octokit, owner, repo, baseTreeSha, filePaths) {
    const isBinaryByPath = new Map();
    const binaryPaths = [];
    for (const p of filePaths) {
        const binary = isBinaryFile(p);
        isBinaryByPath.set(p, binary);
        if (binary) {
            binaryPaths.push(p);
        }
    }
    const blobByPath = new Map();
    for (const filePath of binaryPaths) {
        const result = await createBlob(octokit, owner, repo, filePath);
        blobByPath.set(filePath, result);
    }
    const treeEntries = [];
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    for (const filePath of filePaths) {
        if (isBinaryByPath.get(filePath)) {
            const { sha, mode } = blobByPath.get(filePath);
            treeEntries.push({
                path: filePath,
                mode,
                type: "blob",
                sha,
            });
            continue;
        }
        const mode = getFileMode(filePath);
        const raw = fs.readFileSync(filePath);
        try {
            const content = utf8Decoder.decode(raw);
            treeEntries.push({
                path: filePath,
                mode,
                type: "blob",
                content,
            });
        }
        catch {
            const result = await createBlob(octokit, owner, repo, filePath);
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
    return createTreeChained(octokit, owner, repo, baseTreeSha, treeEntries);
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
    const { token, owner, repo, branch, message, filePaths, allowEmpty, baseSha } = options;
    if (filePaths.length === 0 && !allowEmpty) {
        throw new Error("No files to commit");
    }
    const octokit = github.getOctokit(token);
    // Get branch info (SHA and tree SHA)
    let branchSha;
    let baseTreeSha;
    if (baseSha) {
        // Use provided base SHA
        branchSha = baseSha;
        const { data: commit } = await octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: baseSha,
        });
        baseTreeSha = commit.tree.sha;
    }
    else {
        // Fetch from branch
        const branchInfo = await getBranchInfo(octokit, owner, repo, branch);
        branchSha = branchInfo.sha;
        baseTreeSha = branchInfo.treeSha;
    }
    // For empty commits, reuse parent tree SHA; otherwise create a new tree.
    const newTreeSha = filePaths.length === 0
        ? baseTreeSha
        : await createTree(octokit, owner, repo, baseTreeSha, filePaths);
    // Create commit (automatically signed by GitHub)
    const commitSha = await createCommit(octokit, owner, repo, newTreeSha, branchSha, message);
    // Update branch reference
    await updateBranch(octokit, owner, repo, branch, commitSha, false);
    return {
        commitSha,
        treeSha: newTreeSha,
        filesCommitted: filePaths.length,
    };
}
//# sourceMappingURL=commit.js.map