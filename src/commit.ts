import * as github from "@actions/github";
import * as fs from "fs";

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
export async function createBlob(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  filePath: string
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

  // Determine file mode (100644 for regular files, 100755 for executables)
  const stats = fs.statSync(filePath);
  const mode: "100644" | "100755" =
    stats.mode & parseInt("111", 8) ? "100755" : "100644";

  return { sha: blob.sha, mode };
}

/**
 * Creates a Git tree with updated files via GitHub API
 */
export async function createTree(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  baseTreeSha: string,
  filePaths: string[]
): Promise<string> {
  const treeEntries = [];

  for (const filePath of filePaths) {
    const { sha, mode } = await createBlob(octokit, owner, repo, filePath);
    treeEntries.push({
      path: filePath,
      mode: mode as "100644" | "100755",
      type: "blob" as const,
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
  const { token, owner, repo, branch, message, filePaths, baseSha } = options;

  if (filePaths.length === 0) {
    throw new Error("No files to commit");
  }

  const octokit = github.getOctokit(token);

  // Get branch info (SHA and tree SHA)
  let branchSha: string;
  let baseTreeSha: string;

  if (baseSha) {
    // Use provided base SHA
    branchSha = baseSha;
    const { data: commit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    });
    baseTreeSha = commit.tree.sha;
  } else {
    // Fetch from branch
    const branchInfo = await getBranchInfo(octokit, owner, repo, branch);
    branchSha = branchInfo.sha;
    baseTreeSha = branchInfo.treeSha;
  }

  // Create new tree with updated files
  const newTreeSha = await createTree(
    octokit,
    owner,
    repo,
    baseTreeSha,
    filePaths
  );

  // Create commit (automatically signed by GitHub)
  const commitSha = await createCommit(
    octokit,
    owner,
    repo,
    newTreeSha,
    branchSha,
    message
  );

  // Update branch reference
  await updateBranch(octokit, owner, repo, branch, commitSha, false);

  return {
    commitSha,
    treeSha: newTreeSha,
    filesCommitted: filePaths.length,
  };
}
