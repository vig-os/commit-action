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
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const github = __importStar(require("@actions/github"));
const commit_1 = require("../../commit");
const commit_runner_1 = require("../../commit-runner");
jest.mock("@actions/core", () => ({
    info: jest.fn(),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
}));
jest.mock("child_process", () => ({
    execSync: jest.fn(),
}));
jest.mock("../../commit", () => ({
    commitViaAPI: jest.fn(),
}));
describe("commit-runner", () => {
    describe("normalizeBranch", () => {
        it("should normalize refs/heads/main to main", () => {
            expect((0, commit_runner_1.normalizeBranch)("refs/heads/main")).toBe("main");
        });
        it("should normalize refs/heads/dev to dev", () => {
            expect((0, commit_runner_1.normalizeBranch)("refs/heads/dev")).toBe("dev");
        });
        it("should normalize refs/tags/v1.0.0 to v1.0.0", () => {
            expect((0, commit_runner_1.normalizeBranch)("refs/tags/v1.0.0")).toBe("v1.0.0");
        });
        it("should normalize refs/remotes/origin/main to origin/main", () => {
            expect((0, commit_runner_1.normalizeBranch)("refs/remotes/origin/main")).toBe("origin/main");
        });
        it("should return branch name as-is if it doesn't start with refs/", () => {
            expect((0, commit_runner_1.normalizeBranch)("main")).toBe("main");
            expect((0, commit_runner_1.normalizeBranch)("dev")).toBe("dev");
        });
        it("should handle branch names with slashes", () => {
            expect((0, commit_runner_1.normalizeBranch)("refs/heads/feature/new-feature")).toBe("feature/new-feature");
        });
    });
    describe("resolveBranch", () => {
        const defaultContextRef = "refs/heads/dev";
        it("should prioritize TARGET_BRANCH when set", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "refs/heads/main",
                githubRef: "refs/heads/staging",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("main");
        });
        it("should normalize TARGET_BRANCH without refs/heads/ prefix", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "main",
                githubRef: "refs/heads/staging",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("main");
        });
        it("should use GITHUB_REF when TARGET_BRANCH is not set and GITHUB_REF differs from context", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: undefined,
                githubRef: "refs/heads/main",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("main");
        });
        it("should normalize GITHUB_REF without refs/heads/ prefix", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: undefined,
                githubRef: "main",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("main");
        });
        it("should fall back to contextRef when GITHUB_REF matches context", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: undefined,
                githubRef: defaultContextRef,
                contextRef: defaultContextRef,
            });
            expect(result).toBe("dev");
        });
        it("should fall back to contextRef when GITHUB_REF is not set", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: undefined,
                githubRef: undefined,
                contextRef: defaultContextRef,
            });
            expect(result).toBe("dev");
        });
        it("should fall back to contextRef when both TARGET_BRANCH and GITHUB_REF are not set", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                contextRef: "refs/heads/main",
            });
            expect(result).toBe("main");
        });
        it("should handle empty string TARGET_BRANCH as undefined", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "",
                githubRef: "refs/heads/main",
                contextRef: defaultContextRef,
            });
            // Empty string is falsy, so should use GITHUB_REF
            expect(result).toBe("main");
        });
        it("should handle tag references in TARGET_BRANCH", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "refs/tags/v1.2.3",
                githubRef: "refs/heads/main",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("v1.2.3");
        });
        it("should handle complex branch names with slashes", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "refs/heads/feature/new-feature",
                githubRef: "refs/heads/main",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("feature/new-feature");
        });
        it("should prioritize TARGET_BRANCH even when GITHUB_REF is different from context", () => {
            const result = (0, commit_runner_1.resolveBranch)({
                targetBranch: "refs/heads/production",
                githubRef: "refs/heads/main",
                contextRef: defaultContextRef,
            });
            expect(result).toBe("production");
        });
    });
    describe("main ALLOW_EMPTY behavior", () => {
        const originalEnv = process.env;
        beforeEach(() => {
            jest.clearAllMocks();
            process.env = {
                ...originalEnv,
                GITHUB_TOKEN: "test-token",
                GITHUB_REPOSITORY: "owner/repo",
                TARGET_BRANCH: "refs/heads/main",
                COMMIT_MESSAGE: "Test commit",
            };
            github.context.ref = "refs/heads/main";
            commit_1.commitViaAPI.mockResolvedValue({
                commitSha: "commit-sha",
                treeSha: "tree-sha",
                filesCommitted: 0,
            });
        });
        afterAll(() => {
            process.env = originalEnv;
        });
        it("should pass allowEmpty true to commitViaAPI when ALLOW_EMPTY=true", async () => {
            process.env.ALLOW_EMPTY = "true";
            process.env.FILE_PATHS = "file.txt";
            const fs = require("fs");
            fs.existsSync = jest.fn().mockReturnValue(true);
            fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });
            await (0, commit_runner_1.main)();
            expect(commit_1.commitViaAPI).toHaveBeenCalledWith(expect.objectContaining({
                allowEmpty: true,
            }));
        });
        it("should not exit early when no files and ALLOW_EMPTY=true", async () => {
            process.env.ALLOW_EMPTY = "true";
            delete process.env.FILE_PATHS;
            child_process_1.execSync.mockReturnValue("");
            await (0, commit_runner_1.main)();
            expect(commit_1.commitViaAPI).toHaveBeenCalled();
            expect(core.info).toHaveBeenCalledWith("Creating empty commit (ALLOW_EMPTY=true)");
        });
        it("should return early when no files and ALLOW_EMPTY is unset", async () => {
            delete process.env.ALLOW_EMPTY;
            delete process.env.FILE_PATHS;
            child_process_1.execSync.mockReturnValue("");
            await (0, commit_runner_1.main)();
            expect(core.info).toHaveBeenCalledWith("No files to commit");
            expect(commit_1.commitViaAPI).not.toHaveBeenCalled();
            expect(core.setFailed).not.toHaveBeenCalled();
        });
        it("should treat ALLOW_EMPTY=TRUE as true", async () => {
            process.env.ALLOW_EMPTY = "TRUE";
            process.env.FILE_PATHS = "file.txt";
            const fs = require("fs");
            fs.existsSync = jest.fn().mockReturnValue(true);
            fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });
            await (0, commit_runner_1.main)();
            expect(commit_1.commitViaAPI).toHaveBeenCalledWith(expect.objectContaining({
                allowEmpty: true,
            }));
        });
    });
});
//# sourceMappingURL=commit-runner.test.js.map