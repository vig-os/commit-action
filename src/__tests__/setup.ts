// Setup mocks before any imports
// This file runs before tests, so we can set up the environment

// Mock @actions/github - using manual mock file in __mocks__ directory
jest.mock("@actions/github");

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
