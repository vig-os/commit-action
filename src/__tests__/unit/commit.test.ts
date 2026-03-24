import * as github from "@actions/github";
import {
  commitViaAPI,
  createBlob,
  createCommit,
  createTree,
  getBranchInfo,
  getFileMode,
  isBinaryFile,
  TREE_ENTRY_CHUNK_SIZE,
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
    const fs = require("fs");
    fs.openSync.mockReturnValue(1);
    fs.closeSync.mockImplementation(() => {});
    fs.readSync.mockImplementation(
      (_fd: number, buf: Buffer, offset?: number, length?: number) => {
        const off = offset ?? 0;
        const len = length ?? buf.length - off;
        Buffer.alloc(len, 0x61).copy(buf, off);
        return len;
      }
    );
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
    it("should create a tree with inline content for text files (no createBlob)", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          return "content";
        }
        return Buffer.from("content");
      });
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 7 });

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
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "base-tree-sha",
        tree: [
          { path: "file1.txt", mode: "100644", type: "blob", content: "content" },
          { path: "file2.txt", mode: "100644", type: "blob", content: "content" },
        ],
      });
    });

    it("should use createBlob for binary files (NUL in prefix)", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 4 });
      fs.readSync = jest.fn((_fd: number, buf: Buffer, offset = 0, length?: number) => {
        const n = length ?? buf.length - offset;
        buf[offset] = 0;
        if (n > 1) {
          buf.fill(0x62, offset + 1, offset + n);
        }
        return n;
      });
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          throw new Error("should not read binary as utf-8");
        }
        return Buffer.from([0, 1, 2, 3]);
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-bin-sha" },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: "tree-bin" },
      });

      const result = await createTree(
        mockOctokit as any,
        "owner",
        "repo",
        "base-tree-sha",
        ["file.bin"]
      );

      expect(result).toBe("tree-bin");
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "base-tree-sha",
        tree: [
          { path: "file.bin", mode: "100644", type: "blob", sha: "blob-bin-sha" },
        ],
      });
    });

    it("should mix inline content and blob SHAs preserving path order", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      let readSyncCalls = 0;
      fs.readSync = jest.fn((_fd: number, buf: Buffer, offset = 0, length?: number) => {
        const n = length ?? buf.length - offset;
        readSyncCalls += 1;
        if (readSyncCalls === 2) {
          buf[offset] = 0;
          if (n > 1) {
            buf.fill(0x64, offset + 1, offset + n);
          }
          return n;
        }
        buf.fill(0x63, offset, offset + n);
        return n;
      });
      fs.statSync = jest.fn().mockImplementation(() => ({ mode: 0o644, size: 8 }));
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (path === "a.txt") {
          if (enc === "utf-8") {
            return "hello-a";
          }
          return Buffer.from("hello-a");
        }
        if (path === "b.bin") {
          if (enc === "utf-8") {
            throw new Error("binary");
          }
          return Buffer.from([0xff, 0]);
        }
        if (enc === "utf-8") {
          return "hello-c";
        }
        return Buffer.from("hello-c");
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: "blob-b" },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: "tree-mixed" },
      });

      await createTree(mockOctokit as any, "owner", "repo", "base", [
        "a.txt",
        "b.bin",
        "c.txt",
      ]);

      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "base",
        tree: [
          { path: "a.txt", mode: "100644", type: "blob", content: "hello-a" },
          { path: "b.bin", mode: "100644", type: "blob", sha: "blob-b" },
          { path: "c.txt", mode: "100644", type: "blob", content: "hello-c" },
        ],
      });
    });

    it("should chain createTree when more than TREE_ENTRY_CHUNK_SIZE files", async () => {
      const fs = require("fs");
      const n = TREE_ENTRY_CHUNK_SIZE + 1;
      const paths = Array.from({ length: n }, (_, i) => `f${i}.txt`);
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 4 });
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          return "ab";
        }
        return Buffer.from("ab");
      });

      mockOctokit.rest.git.createTree
        .mockResolvedValueOnce({ data: { sha: "tree-chunk-1" } })
        .mockResolvedValueOnce({ data: { sha: "tree-chunk-2" } });

      const result = await createTree(
        mockOctokit as any,
        "owner",
        "repo",
        "base-tree-sha",
        paths
      );

      expect(result).toBe("tree-chunk-2");
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].base_tree).toBe(
        "base-tree-sha"
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].tree).toHaveLength(
        TREE_ENTRY_CHUNK_SIZE
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].base_tree).toBe(
        "tree-chunk-1"
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].tree).toHaveLength(1);
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });
  });

  describe("isBinaryFile", () => {
    it("returns false when prefix has no NUL byte", () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ size: 5 });
      fs.readSync = jest.fn((_fd: number, buf: Buffer, offset = 0, length?: number) => {
        const n = length ?? buf.length - offset;
        Buffer.from("hello").copy(buf, offset, 0, n);
        return n;
      });

      expect(isBinaryFile("x.txt")).toBe(false);
    });

    it("returns true when NUL appears in scanned prefix", () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ size: 10 });
      fs.readSync = jest.fn((_fd: number, buf: Buffer, offset = 0, length?: number) => {
        const n = length ?? buf.length - offset;
        buf.fill(0x65, offset, offset + n);
        buf[offset + 2] = 0;
        return n;
      });

      expect(isBinaryFile("x.bin")).toBe(true);
    });

    it("throws when file is missing", () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(false);
      expect(() => isBinaryFile("missing")).toThrow("File not found");
    });
  });

  describe("getFileMode", () => {
    it("returns 100644 for non-executable file", () => {
      const fs = require("fs");
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644 });
      expect(getFileMode("f")).toBe("100644");
    });

    it("returns 100755 when executable bit is set", () => {
      const fs = require("fs");
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o755 });
      expect(getFileMode("run")).toBe("100755");
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
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          return "content";
        }
        return Buffer.from("content");
      });
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 7 });

      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: "base-sha" } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
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
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });

    it("should use provided baseSha if given", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          return "content";
        }
        return Buffer.from("content");
      });
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 7 });

      // Mock commit fetch for baseSha
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
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

    it("should create an empty commit when allowEmpty is true and filePaths is empty", async () => {
      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: "base-sha" } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: "empty-commit-sha" },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: "test-token",
        owner: "owner",
        repo: "repo",
        branch: "dev",
        message: "Test empty commit",
        filePaths: [],
        allowEmpty: true,
      });

      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createTree).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        message: "Test empty commit",
        tree: "base-tree-sha",
        parents: ["base-sha"],
      });
      expect(result.commitSha).toBe("empty-commit-sha");
      expect(result.treeSha).toBe("base-tree-sha");
      expect(result.filesCommitted).toBe(0);
    });

    it("should commit normally when allowEmpty is true and files are provided", async () => {
      const fs = require("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn((path: string, enc?: string) => {
        if (enc === "utf-8") {
          return "content";
        }
        return Buffer.from("content");
      });
      fs.statSync = jest.fn().mockReturnValue({ mode: 0o644, size: 7 });

      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: "base-sha" } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
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
        allowEmpty: true,
      });

      expect(mockOctokit.rest.git.createTree).toHaveBeenCalled();
      expect(result.commitSha).toBe("commit-sha");
      expect(result.treeSha).toBe("new-tree-sha");
      expect(result.filesCommitted).toBe(1);
    });
  });
});
