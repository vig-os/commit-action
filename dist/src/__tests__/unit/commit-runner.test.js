"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commit_runner_1 = require("../../commit-runner");
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
});
//# sourceMappingURL=commit-runner.test.js.map