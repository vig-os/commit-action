#!/usr/bin/env node
"use strict";
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
 * - ALLOW_EMPTY: Set to "true" to allow empty commits when no files changed (default: false)
 * - MAX_ATTEMPTS: Max retry attempts for transient API failures (default: 1 = no retries)
 */
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
exports.normalizeBranch = normalizeBranch;
exports.resolveBranch = resolveBranch;
exports.main = main;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commit_1 = require("./commit");
/**
 * Normalizes a Git reference to a branch name
 * @param ref - Git reference (e.g., "refs/heads/main", "refs/tags/v1.0.0", or just "main")
 * @returns Normalized branch/tag name
 */
function normalizeBranch(ref) {
    if (ref.startsWith("refs/heads/")) {
        return ref.replace("refs/heads/", "");
    }
    else if (ref.startsWith("refs/")) {
        return ref.replace(/^refs\/[^/]+\//, "");
    }
    return ref;
}
/**
 * Resolves the target branch from environment variables and context
 * Priority: TARGET_BRANCH > GITHUB_REF (if different from context) > context.ref
 * @param options - Branch resolution options
 * @returns Resolved branch name
 */
function resolveBranch(options) {
    const { targetBranch, githubRef, contextRef } = options;
    if (targetBranch) {
        // TARGET_BRANCH takes precedence (avoids conflicts with built-in GITHUB_REF)
        return normalizeBranch(targetBranch);
    }
    else if (githubRef && githubRef !== contextRef) {
        // GITHUB_REF explicitly set and different from context - use it
        return normalizeBranch(githubRef);
    }
    else {
        // Fall back to workflow context
        return normalizeBranch(contextRef);
    }
}
function isGitMetadataPath(targetPath) {
    const segments = path
        .normalize(targetPath)
        .split(/[\\/]+/)
        .filter((segment) => segment.length > 0);
    return segments.includes(".git");
}
function findFilesRecursively(dir) {
    const files = [];
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        if (isGitMetadataPath(fullPath)) {
            continue;
        }
        const entryStats = fs.statSync(fullPath);
        if (entryStats.isDirectory()) {
            files.push(...findFilesRecursively(fullPath));
        }
        else if (entryStats.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}
async function main() {
    try {
        // Get token from environment
        const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
        if (!token) {
            throw new Error("GITHUB_TOKEN or GH_TOKEN environment variable is required");
        }
        // Get repository info
        const repository = process.env.GITHUB_REPOSITORY ||
            github.context.repo.owner + "/" + github.context.repo.repo;
        const [owner, repo] = repository.split("/");
        if (!owner || !repo) {
            throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`);
        }
        // Get branch from TARGET_BRANCH (preferred), GITHUB_REF, or context
        const targetBranch = process.env.TARGET_BRANCH;
        const explicitRef = process.env.GITHUB_REF;
        const contextRef = github.context.ref;
        const branch = resolveBranch({
            targetBranch,
            githubRef: explicitRef,
            contextRef,
        });
        // Log which source was used
        if (targetBranch) {
            core.info(`Using TARGET_BRANCH: ${branch}`);
        }
        else if (explicitRef && explicitRef !== contextRef) {
            core.info(`Using explicit GITHUB_REF: ${branch} (was: ${explicitRef}, context: ${contextRef})`);
        }
        else {
            core.info(`Using branch from workflow context: ${branch} (GITHUB_REF was: ${explicitRef})`);
        }
        // Get commit message
        const message = process.env.COMMIT_MESSAGE || "chore: update files";
        const allowEmpty = (process.env.ALLOW_EMPTY || "").toLowerCase() === "true";
        // Get file paths from environment or detect from git status
        let filePaths = [];
        if (process.env.FILE_PATHS) {
            const paths = process.env.FILE_PATHS.split(",")
                .map((p) => p.trim())
                .filter((p) => p.length > 0);
            // Expand directories to individual files
            for (const pathItem of paths) {
                if (isGitMetadataPath(pathItem)) {
                    continue;
                }
                if (fs.existsSync(pathItem)) {
                    const stats = fs.statSync(pathItem);
                    if (stats.isDirectory()) {
                        filePaths.push(...findFilesRecursively(pathItem));
                    }
                    else {
                        filePaths.push(pathItem);
                    }
                }
            }
        }
        else {
            // Detect changed files from git status
            try {
                const gitStatus = (0, child_process_1.execSync)("git status --porcelain", {
                    encoding: "utf-8",
                });
                const changedFiles = gitStatus
                    .split("\n")
                    .filter((line) => line.trim().length > 0)
                    .map((line) => {
                    // git status format: "XY filename" where X is staged, Y is working tree
                    // We want files that are Added (A) or Modified (M) in working tree
                    const match = line.match(/^[AM]\s+(.+)$/);
                    return match ? match[1] : null;
                })
                    .filter((file) => file !== null && fs.existsSync(file));
                filePaths = changedFiles;
            }
            catch (error) {
                throw new Error(`Failed to detect changed files from git status: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }
        if (filePaths.length === 0 && !allowEmpty) {
            core.info("No files to commit");
            return;
        }
        if (filePaths.length === 0 && allowEmpty) {
            core.info("Creating empty commit (ALLOW_EMPTY=true)");
        }
        core.info(`Committing ${filePaths.length} file(s) to branch ${branch}`);
        core.info(`Files: ${filePaths.join(", ")}`);
        // Get base SHA if provided (for testing or specific use cases)
        const baseSha = process.env.BASE_SHA;
        // Parse MAX_ATTEMPTS for retry (default 1 = no retries)
        let maxAttempts = 1;
        const rawAttempts = process.env.MAX_ATTEMPTS;
        if (rawAttempts) {
            const parsed = parseInt(rawAttempts, 10);
            if (Number.isNaN(parsed) || parsed < 1) {
                core.info(`MAX_ATTEMPTS="${rawAttempts}" invalid, using 1 (no retries)`);
            }
            else {
                maxAttempts = parsed;
                if (maxAttempts > 1) {
                    core.info(`API retries enabled: max ${maxAttempts} attempts`);
                }
            }
        }
        // Commit changes via API
        const result = await (0, commit_1.commitViaAPI)({
            token,
            owner,
            repo,
            branch,
            message,
            filePaths,
            allowEmpty,
            baseSha,
            maxAttempts,
            logger: core.info,
        });
        core.info(`Created signed commit ${result.commitSha} via GitHub API`);
        core.setOutput("commit-sha", result.commitSha);
        core.setOutput("tree-sha", result.treeSha);
        core.setOutput("files-committed", result.filesCommitted.toString());
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed("Unknown error occurred");
        }
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=commit-runner.js.map