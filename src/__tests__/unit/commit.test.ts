import * as github from "@actions/github";
import {
  commitViaAPI,
  createBlob,
  createCommit,
  createTree,
  getBranchInfo,
  updateBranch,
} from "../../commit";

// Mock modules
jest.mock("@actions/github");
jest.mock("fs");

describe("commit", () => {
  const mockOctokit = {
    rest: {
      git: {
        getRef: jest.fn(),
        getCommit: jest.fn(),
        createBlob: jest.fn(),
        createTree: jest.fn(),
        createCommit: jest.fn(),
        updateRef: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
  });

  describe("createBlob", () => {
    it("should create a blob for a file", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue(Buffer.from("test content"));
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644 });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha-123" },
      });

      const result = await createBlob(
        mockOctokit as any,
        "owner",
        "repo",
        "test.txt"
      );

      expect(result.sha).toBe("blob-sha-123");
      expect(result.mode).toBe("100644");
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        content: expect.any(String),
        encoding: "base64",
      });
    });

    it("should throw error if file does not exist", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(false);

      await expect(
        createBlob(mockOctokit as any, "owner", "repo", "nonexistent.txt")
      ).rejects.toThrow("File not found");
    });
  });

  describe("createTree", () => {
    it("should create a tree with file entries", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue(Buffer.from("content"));
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644 });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha" },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: "tree-sha-123" },
      });

      const result = await createTree(
        mockOctokit as any,
        "owner",
        "repo",
        "base-tree-sha",
        ["file1.txt", "file2.txt"]
      );

      expect(result).toBe("tree-sha-123");
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "base-tree-sha",
        tree: [
          { path: "file1.txt", mode: "100644", type: "blob", sha: "blob-sha" },
          { path: "file2.txt", mode: "100644", type: "blob", sha: "blob-sha" },
        ],
      });
    });
  });

  describe("createCommit", () => {
    it("should create a commit", async () => {
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: "commit-sha-123" },
      });

      const result = await createCommit(
        mockOctokit as any,
        "owner",
        "repo",
        "tree-sha",
        "parent-sha",
        "Test commit"
      );

      expect(result).toBe("commit-sha-123");
      expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        message: "Test commit",
        tree: "tree-sha",
        parents: ["parent-sha"],
      });
    });
  });

  describe("updateBranch", () => {
    it("should update branch reference", async () => {
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      await updateBranch(
        mockOctokit as any,
        "owner",
        "repo",
        "dev",
        "commit-sha",
        false
      );

      expect(mockOctokit.rest.git.updateRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/dev",
        sha: "commit-sha",
        force: false,
      });
    });
  });

  describe("getBranchInfo", () => {
    it("should get branch SHA and tree SHA", async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: "branch-sha" } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "tree-sha" } },
      });

      const result = await getBranchInfo(
        mockOctokit as any,
        "owner",
        "repo",
        "dev"
      );

      expect(result.sha).toBe("branch-sha");
      expect(result.treeSha).toBe("tree-sha");
    });
  });

  describe("commitViaAPI", () => {
    it("should commit changes end-to-end", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue(Buffer.from("content"));
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644 });

      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: "base-sha" } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });

      // Mock blob creation
      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha" },
      });

      // Mock tree creation
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: "new-tree-sha" },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: "commit-sha" },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: "test-token",
        owner: "owner",
        repo: "repo",
        branch: "dev",
        message: "Test commit",
        filePaths: ["file1.txt", "file2.txt"],
      });

      expect(result.commitSha).toBe("commit-sha");
      expect(result.treeSha).toBe("new-tree-sha");
      expect(result.filesCommitted).toBe(2);
    });

    it("should use provided baseSha if given", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue(Buffer.from("content"));
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644 });

      // Mock commit fetch for baseSha
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });

      // Mock blob creation
      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha" },
      });

      // Mock tree creation
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: "new-tree-sha" },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: "commit-sha" },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: "test-token",
        owner: "owner",
        repo: "repo",
        branch: "dev",
        message: "Test commit",
        filePaths: ["file1.txt"],
        baseSha: "provided-base-sha",
      });

      expect(mockOctokit.rest.git.getCommit).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        commit_sha: "provided-base-sha",
      });
      expect(result.commitSha).toBe("commit-sha");
    });

    it("should throw error if no files provided", async () => {
      await expect(
        commitViaAPI({
          token: "test-token",
          owner: "owner",
          repo: "repo",
          branch: "dev",
          message: "Test commit",
          filePaths: [],
        })
      ).rejects.toThrow("No files to commit");
    });
  });
});
