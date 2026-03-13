import * as core from "@actions/core";
import { execSync } from "child_process";
import * as github from "@actions/github";
import { commitViaAPI } from "../../commit";
import { main, normalizeBranch, resolveBranch } from "../../commit-runner";

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
      (github.context as any).ref = "refs/heads/main";
      (commitViaAPI as jest.Mock).mockResolvedValue({
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

      const fs = jest.requireMock("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });

      await main();

      expect(commitViaAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          allowEmpty: true,
        })
      );
    });

    it("should not exit early when no files and ALLOW_EMPTY=true", async () => {
      process.env.ALLOW_EMPTY = "true";
      delete process.env.FILE_PATHS;
      (execSync as jest.Mock).mockReturnValue("");

      await main();

      expect(commitViaAPI).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith("Creating empty commit (ALLOW_EMPTY=true)");
    });

    it("should return early when no files and ALLOW_EMPTY is unset", async () => {
      delete process.env.ALLOW_EMPTY;
      delete process.env.FILE_PATHS;
      (execSync as jest.Mock).mockReturnValue("");

      await main();

      expect(core.info).toHaveBeenCalledWith("No files to commit");
      expect(commitViaAPI).not.toHaveBeenCalled();
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it("should treat ALLOW_EMPTY=TRUE as true", async () => {
      process.env.ALLOW_EMPTY = "TRUE";
      process.env.FILE_PATHS = "file.txt";

      const fs = jest.requireMock("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });

      await main();

      expect(commitViaAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          allowEmpty: true,
        })
      );
    });
  });

  describe("main FILE_PATHS directory expansion", () => {
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
      (github.context as any).ref = "refs/heads/main";
      (commitViaAPI as jest.Mock).mockResolvedValue({
        commitSha: "commit-sha",
        treeSha: "tree-sha",
        filesCommitted: 0,
      });
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should exclude .git directory contents when expanding FILE_PATHS directories", async () => {
      process.env.FILE_PATHS = ".";

      const fs = jest.requireMock("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readdirSync = jest.fn((dir: string) => {
        if (dir === ".") return ["src", ".git", "README.md"];
        if (dir === "src") return ["index.ts"];
        if (dir === ".git") return ["config", "objects"];
        if (dir === ".git/objects") return ["abc123"];
        return [];
      });
      fs.statSync = jest.fn((targetPath: string) => {
        const isDirectory =
          targetPath === "." ||
          targetPath === "src" ||
          targetPath === ".git" ||
          targetPath === ".git/objects";
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        };
      });

      await main();

      expect(commitViaAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          filePaths: ["src/index.ts", "README.md"],
        })
      );
    });

    it("should ignore direct .git paths in FILE_PATHS while keeping normal paths", async () => {
      process.env.FILE_PATHS = ".git,.git/config,README.md,src/index.ts";

      const fs = jest.requireMock("fs");
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.statSync = jest.fn().mockReturnValue({
        isDirectory: () => false,
      });

      await main();

      expect(commitViaAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          filePaths: ["README.md", "src/index.ts"],
        })
      );
    });
  });
});
