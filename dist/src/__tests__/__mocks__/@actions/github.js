"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.context = exports.getOctokit = void 0;
// Manual mock for @actions/github
exports.getOctokit = jest.fn();
exports.context = {
    repo: {
        owner: "test-owner",
        repo: "test-repo",
    },
    ref: "refs/heads/main",
};
//# sourceMappingURL=github.js.map