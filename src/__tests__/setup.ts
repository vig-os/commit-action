// Setup mocks before any imports
// This file runs before tests, so we can set up the environment

// Mock @actions/github
jest.mock("@actions/github", () => {
  return {
    getOctokit: jest.fn(),
    context: {
      repo: {
        owner: "test-owner",
        repo: "test-repo",
      },
      ref: "refs/heads/main",
    },
  };
});

// Mock fs
jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs");
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    statSync: jest.fn(),
    readdirSync: jest.fn(),
  };
});
