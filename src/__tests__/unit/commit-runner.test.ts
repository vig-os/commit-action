import { normalizeBranch, resolveBranch } from "../../commit-runner";

describe("commit-runner", () => {
  describe("normalizeBranch", () => {
    it("should normalize refs/heads/main to main", () => {
      expect(normalizeBranch("refs/heads/main")).toBe("main");
    });

    it("should normalize refs/heads/dev to dev", () => {
      expect(normalizeBranch("refs/heads/dev")).toBe("dev");
    });

    it("should normalize refs/tags/v1.0.0 to v1.0.0", () => {
      expect(normalizeBranch("refs/tags/v1.0.0")).toBe("v1.0.0");
    });

    it("should normalize refs/remotes/origin/main to origin/main", () => {
      expect(normalizeBranch("refs/remotes/origin/main")).toBe("origin/main");
    });

    it("should return branch name as-is if it doesn't start with refs/", () => {
      expect(normalizeBranch("main")).toBe("main");
      expect(normalizeBranch("dev")).toBe("dev");
    });

    it("should handle branch names with slashes", () => {
      expect(normalizeBranch("refs/heads/feature/new-feature")).toBe(
        "feature/new-feature"
      );
    });
  });

  describe("resolveBranch", () => {
    const defaultContextRef = "refs/heads/dev";

    it("should prioritize TARGET_BRANCH when set", () => {
      const result = resolveBranch({
        targetBranch: "refs/heads/main",
        githubRef: "refs/heads/staging",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("main");
    });

    it("should normalize TARGET_BRANCH without refs/heads/ prefix", () => {
      const result = resolveBranch({
        targetBranch: "main",
        githubRef: "refs/heads/staging",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("main");
    });

    it("should use GITHUB_REF when TARGET_BRANCH is not set and GITHUB_REF differs from context", () => {
      const result = resolveBranch({
        targetBranch: undefined,
        githubRef: "refs/heads/main",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("main");
    });

    it("should normalize GITHUB_REF without refs/heads/ prefix", () => {
      const result = resolveBranch({
        targetBranch: undefined,
        githubRef: "main",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("main");
    });

    it("should fall back to contextRef when GITHUB_REF matches context", () => {
      const result = resolveBranch({
        targetBranch: undefined,
        githubRef: defaultContextRef,
        contextRef: defaultContextRef,
      });
      expect(result).toBe("dev");
    });

    it("should fall back to contextRef when GITHUB_REF is not set", () => {
      const result = resolveBranch({
        targetBranch: undefined,
        githubRef: undefined,
        contextRef: defaultContextRef,
      });
      expect(result).toBe("dev");
    });

    it("should fall back to contextRef when both TARGET_BRANCH and GITHUB_REF are not set", () => {
      const result = resolveBranch({
        contextRef: "refs/heads/main",
      });
      expect(result).toBe("main");
    });

    it("should handle empty string TARGET_BRANCH as undefined", () => {
      const result = resolveBranch({
        targetBranch: "",
        githubRef: "refs/heads/main",
        contextRef: defaultContextRef,
      });
      // Empty string is falsy, so should use GITHUB_REF
      expect(result).toBe("main");
    });

    it("should handle tag references in TARGET_BRANCH", () => {
      const result = resolveBranch({
        targetBranch: "refs/tags/v1.2.3",
        githubRef: "refs/heads/main",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("v1.2.3");
    });

    it("should handle complex branch names with slashes", () => {
      const result = resolveBranch({
        targetBranch: "refs/heads/feature/new-feature",
        githubRef: "refs/heads/main",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("feature/new-feature");
    });

    it("should prioritize TARGET_BRANCH even when GITHUB_REF is different from context", () => {
      const result = resolveBranch({
        targetBranch: "refs/heads/production",
        githubRef: "refs/heads/main",
        contextRef: defaultContextRef,
      });
      expect(result).toBe("production");
    });
  });
});
