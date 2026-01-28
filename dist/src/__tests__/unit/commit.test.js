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
const github = __importStar(require("@actions/github"));
const commit_1 = require("../../commit");
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
        github.getOctokit.mockReturnValue(mockOctokit);
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
            const result = await (0, commit_1.createBlob)(mockOctokit, "owner", "repo", "test.txt");
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
            await expect((0, commit_1.createBlob)(mockOctokit, "owner", "repo", "nonexistent.txt")).rejects.toThrow("File not found");
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
            const result = await (0, commit_1.createTree)(mockOctokit, "owner", "repo", "base-tree-sha", ["file1.txt", "file2.txt"]);
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
            const result = await (0, commit_1.createCommit)(mockOctokit, "owner", "repo", "tree-sha", "parent-sha", "Test commit");
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
            await (0, commit_1.updateBranch)(mockOctokit, "owner", "repo", "dev", "commit-sha", false);
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
            const result = await (0, commit_1.getBranchInfo)(mockOctokit, "owner", "repo", "dev");
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
            const result = await (0, commit_1.commitViaAPI)({
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
            const result = await (0, commit_1.commitViaAPI)({
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
            await expect((0, commit_1.commitViaAPI)({
                token: "test-token",
                owner: "owner",
                repo: "repo",
                branch: "dev",
                message: "Test commit",
                filePaths: [],
            })).rejects.toThrow("No files to commit");
        });
    });
});
//# sourceMappingURL=commit.test.js.map