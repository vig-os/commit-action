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
exports.createBlob = createBlob;
exports.createTree = createTree;
exports.createCommit = createCommit;
exports.updateBranch = updateBranch;
exports.getBranchInfo = getBranchInfo;
exports.commitViaAPI = commitViaAPI;
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
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
    // Determine file mode (100644 for regular files, 100755 for executables)
    const stats = fs.statSync(filePath);
    const mode = stats.mode & parseInt("111", 8) ? "100755" : "100644";
    return { sha: blob.sha, mode };
}
/**
 * Creates a Git tree with updated files via GitHub API
 */
async function createTree(octokit, owner, repo, baseTreeSha, filePaths) {
    const treeEntries = [];
    for (const filePath of filePaths) {
        const { sha, mode } = await createBlob(octokit, owner, repo, filePath);
        treeEntries.push({
            path: filePath,
            mode: mode,
            type: "blob",
            sha,
        });
    }
    const { data: tree } = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: treeEntries,
    });
    return tree.sha;
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