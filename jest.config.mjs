export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/unit/**/*.test.ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  extensionsToTreatAsEsm: [".ts"],
  // Under NodeNext, TS sources import siblings as "./commit.js"; on disk they
  // are .ts. Strip the extension so Jest resolves the source, not the build.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: "tsconfig.test.json", useESM: true },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/__tests__/**"],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
