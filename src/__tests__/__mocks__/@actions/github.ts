// Manual mock for @actions/github
export const getOctokit = jest.fn();
export const context = {
  repo: {
    owner: "test-owner",
    repo: "test-repo",
  },
  ref: "refs/heads/main",
};
