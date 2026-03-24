"use strict";
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
        /** Used by isBinaryFile — provides openSync/readSync/closeSync for binary detection tests */
        openSync: jest.fn().mockReturnValue(1),
        readSync: jest.fn((_fd, buf, offset, length) => {
            const off = offset ?? 0;
            const len = length ?? buf.length - off;
            Buffer.alloc(len, 0x61).copy(buf, off);
            return len;
        }),
        closeSync: jest.fn(),
    };
});
//# sourceMappingURL=setup.js.map