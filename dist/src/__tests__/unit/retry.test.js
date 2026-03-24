"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retry_1 = require("../../retry");
describe("retry", () => {
    describe("isTransientError", () => {
        it("returns true for error with status 404", () => {
            expect((0, retry_1.isTransientError)({ status: 404 })).toBe(true);
        });
        it("returns true for errors with status 500, 502, 503", () => {
            expect((0, retry_1.isTransientError)({ status: 500 })).toBe(true);
            expect((0, retry_1.isTransientError)({ status: 502 })).toBe(true);
            expect((0, retry_1.isTransientError)({ status: 503 })).toBe(true);
        });
        it("returns true for status 429", () => {
            expect((0, retry_1.isTransientError)({ status: 429 })).toBe(true);
        });
        it("returns true for status 403 with message containing 'secondary rate limit'", () => {
            expect((0, retry_1.isTransientError)({ status: 403, message: "secondary rate limit exceeded" })).toBe(true);
            expect((0, retry_1.isTransientError)({ status: 403, message: "API rate limit exceeded" })).toBe(true);
            expect((0, retry_1.isTransientError)({ status: 403, message: "You have exceeded abuse rate limit" })).toBe(true);
        });
        it("returns false for status 403 without rate-limit message", () => {
            expect((0, retry_1.isTransientError)({ status: 403, message: "Forbidden" })).toBe(false);
        });
        it("returns false for status 422 (validation error)", () => {
            expect((0, retry_1.isTransientError)({ status: 422 })).toBe(false);
        });
        it("returns false for generic Error with no status", () => {
            expect((0, retry_1.isTransientError)(new Error("something broke"))).toBe(false);
        });
    });
    describe("classifyError", () => {
        it("returns descriptive string for 404", () => {
            expect((0, retry_1.classifyError)({ status: 404 })).toContain("404");
            expect((0, retry_1.classifyError)({ status: 404 })).toContain("transient");
        });
        it("returns descriptive string for 5xx", () => {
            expect((0, retry_1.classifyError)({ status: 500 })).toContain("500");
            expect((0, retry_1.classifyError)({ status: 503 })).toContain("503");
        });
        it("returns descriptive string for 429", () => {
            expect((0, retry_1.classifyError)({ status: 429 })).toContain("429");
        });
        it("returns descriptive string for 403 rate limit", () => {
            expect((0, retry_1.classifyError)({ status: 403, message: "secondary rate limit" })).toMatch(/rate limit|403/i);
        });
        it("returns non-transient for unknown errors", () => {
            expect((0, retry_1.classifyError)(new Error("unknown"))).toContain("non-transient");
        });
    });
    describe("calculateDelay", () => {
        const base = 1000;
        const max = 10000;
        it("returns value in expected range for attempt 0", () => {
            const delay = (0, retry_1.calculateDelay)(0, base, max);
            expect(delay).toBeGreaterThanOrEqual(1000);
            expect(delay).toBeLessThanOrEqual(1000 * 1.25);
        });
        it("returns value in expected range for attempt 1", () => {
            const delay = (0, retry_1.calculateDelay)(1, base, max);
            expect(delay).toBeGreaterThanOrEqual(2000);
            expect(delay).toBeLessThanOrEqual(2000 * 1.25);
        });
        it("never exceeds maxDelayMs plus jitter", () => {
            const delay = (0, retry_1.calculateDelay)(10, base, max);
            expect(delay).toBeLessThanOrEqual(max * 1.25);
        });
    });
    describe("withRetry", () => {
        it("resolves immediately on success with single call", async () => {
            const fn = jest.fn().mockResolvedValue("ok");
            const result = await (0, retry_1.withRetry)(fn, { maxAttempts: 3 });
            expect(result).toBe("ok");
            expect(fn).toHaveBeenCalledTimes(1);
        });
        it("does not retry when maxAttempts is 1", async () => {
            const fn = jest.fn().mockRejectedValue({ status: 404 });
            await expect((0, retry_1.withRetry)(fn, { maxAttempts: 1 })).rejects.toEqual({
                status: 404,
            });
            expect(fn).toHaveBeenCalledTimes(1);
        });
        it("retries transient errors up to maxAttempts and succeeds on later attempt", async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce({ status: 404 })
                .mockResolvedValueOnce("ok");
            jest.useFakeTimers();
            const resultPromise = (0, retry_1.withRetry)(fn, { maxAttempts: 3 });
            await jest.runAllTimersAsync();
            const result = await resultPromise;
            expect(result).toBe("ok");
            expect(fn).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });
        it("throws after exhausting all attempts on persistent transient error", async () => {
            const fn = jest.fn().mockRejectedValue({ status: 503 });
            const resultPromise = (0, retry_1.withRetry)(fn, {
                maxAttempts: 3,
                baseDelayMs: 1,
                maxDelayMs: 5,
            });
            await expect(resultPromise).rejects.toMatchObject({ status: 503 });
            expect(fn).toHaveBeenCalledTimes(3);
        });
        it("does not retry non-transient errors, throws immediately", async () => {
            const fn = jest.fn().mockRejectedValue({ status: 422 });
            await expect((0, retry_1.withRetry)(fn, { maxAttempts: 3 })).rejects.toEqual({
                status: 422,
            });
            expect(fn).toHaveBeenCalledTimes(1);
        });
        it("calls logger with attempt number, classification, and delay", async () => {
            const logger = jest.fn();
            const fn = jest
                .fn()
                .mockRejectedValueOnce({ status: 404 })
                .mockResolvedValueOnce("ok");
            jest.useFakeTimers();
            const resultPromise = (0, retry_1.withRetry)(fn, { maxAttempts: 3 }, logger);
            await jest.runAllTimersAsync();
            await resultPromise;
            expect(logger).toHaveBeenCalled();
            const logCall = logger.mock.calls[0][0];
            expect(logCall).toMatch(/attempt|404|retry/i);
            jest.useRealTimers();
        });
        it("applies backoff delay between attempts", async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce({ status: 404 })
                .mockRejectedValueOnce({ status: 404 })
                .mockResolvedValueOnce("ok");
            jest.useFakeTimers();
            const resultPromise = (0, retry_1.withRetry)(fn, {
                maxAttempts: 3,
                baseDelayMs: 100,
                maxDelayMs: 500,
            });
            await jest.runAllTimersAsync();
            await resultPromise;
            expect(fn).toHaveBeenCalledTimes(3);
            jest.useRealTimers();
        });
    });
});
//# sourceMappingURL=retry.test.js.map