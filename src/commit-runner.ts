#!/usr/bin/env node
/**
 * CLI runner for commit module
 * Reads environment variables and commits changes via GitHub API
 *
 * Environment variables:
 * - GITHUB_TOKEN: GitHub token (app token or regular token)
 * - GITHUB_REPOSITORY: Repository in format "owner/repo"
 * - GITHUB_REF: Branch reference (e.g., "refs/heads/dev")
 * - COMMIT_MESSAGE: Commit message
 * - FILE_PATHS: Comma-separated list of file paths to commit (or read from git status)
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { commitViaAPI } from "./commit";

async function main(): Promise<void> {
  try {
    // Get token from environment
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN or GH_TOKEN environment variable is required"
      );
    }

    // Get repository info
    const repository =
      process.env.GITHUB_REPOSITORY ||
      github.context.repo.owner + "/" + github.context.repo.repo;
    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      throw new Error(
        `Invalid repository format: ${repository}. Expected "owner/repo"`
      );
    }

    // Get branch from GITHUB_REF or context
    let branch = process.env.GITHUB_REF;
    if (branch && branch.startsWith("refs/heads/")) {
      branch = branch.replace("refs/heads/", "");
    } else if (!branch) {
      branch = github.context.ref.replace("refs/heads/", "");
    }

    // Get commit message
    const message = process.env.COMMIT_MESSAGE || "chore: update files";

    // Get file paths from environment or detect from git status
    let filePaths: string[] = [];
    if (process.env.FILE_PATHS) {
      const paths = process.env.FILE_PATHS.split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      // Expand directories to individual files
      for (const pathItem of paths) {
        if (fs.existsSync(pathItem)) {
          const stats = fs.statSync(pathItem);
          if (stats.isDirectory()) {
            // Recursively find all files in directory
            const findFiles = (dir: string): string[] => {
              const files: string[] = [];
              const entries = fs.readdirSync(dir);
              for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const entryStats = fs.statSync(fullPath);
                if (entryStats.isDirectory()) {
                  files.push(...findFiles(fullPath));
                } else if (entryStats.isFile()) {
                  files.push(fullPath);
                }
              }
              return files;
            };
            filePaths.push(...findFiles(pathItem));
          } else {
            filePaths.push(pathItem);
          }
        }
      }
    } else {
      // Detect changed files from git status
      try {
        const gitStatus = execSync("git status --porcelain", {
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
          .filter(
            (file): file is string => file !== null && fs.existsSync(file)
          );

        filePaths = changedFiles;
      } catch (error) {
        throw new Error(
          `Failed to detect changed files from git status: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    if (filePaths.length === 0) {
      core.info("No files to commit");
      process.exit(0);
    }

    core.info(`Committing ${filePaths.length} file(s) to branch ${branch}`);
    core.info(`Files: ${filePaths.join(", ")}`);

    // Get base SHA if provided (for testing or specific use cases)
    const baseSha = process.env.BASE_SHA;

    // Commit changes via API
    const result = await commitViaAPI({
      token,
      owner,
      repo,
      branch,
      message,
      filePaths,
      baseSha,
    });

    core.info(`Created signed commit ${result.commitSha} via GitHub API`);
    core.setOutput("commit-sha", result.commitSha);
    core.setOutput("tree-sha", result.treeSha);
    core.setOutput("files-committed", result.filesCommitted.toString());
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("Unknown error occurred");
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
