"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAX_DELAY_MS = exports.DEFAULT_BASE_DELAY_MS = exports.DEFAULT_MAX_ATTEMPTS = void 0;
exports.isTransientError = isTransientError;
exports.classifyError = classifyError;
exports.calculateDelay = calculateDelay;
exports.withRetry = withRetry;
/** Default max attempts (1 = no retries, backward compatible). */
exports.DEFAULT_MAX_ATTEMPTS = 1;
/** Default base delay for exponential backoff, in milliseconds. */
exports.DEFAULT_BASE_DELAY_MS = 1000;
/** Default maximum delay cap for backoff, in milliseconds. */
exports.DEFAULT_MAX_DELAY_MS = 30000;
/** HTTP-like error shape from Octokit RequestError. */
function hasStatus(e) {
    if (typeof e !== "object" || e === null || !("status" in e)) {
        return false;
    }
    return typeof e.status === "number";
}
/**
 * Returns true if the error is a transient condition worth retrying:
 * - 404 (transient ref/commit lookup)
 * - 5xx (server error)
 * - 429 (primary rate limit)
 * - 403 with rate limit / secondary rate limit / abuse in message
 */
function isTransientError(error) {
    if (!hasStatus(error))
        return false;
    const { status, message = "" } = error;
    const msg = message.toLowerCase();
    if (status === 404)
        return true;
    if (status >= 500 && status < 600)
        return true;
    if (status === 429)
        return true;
    if (status === 403) {
        return (msg.includes("rate limit") ||
            msg.includes("secondary rate limit") ||
            msg.includes("abuse"));
    }
    return false;
}
/** Human-readable classification for logging. */
function classifyError(error) {
    if (!hasStatus(error))
        return "non-transient";
    const { status, message = "" } = error;
    const msg = message.toLowerCase();
    if (status === 404)
        return "HTTP 404 (transient)";
    if (status >= 500 && status < 600)
        return `HTTP ${status} (server error)`;
    if (status === 429)
        return "HTTP 429 (rate limit)";
    if (status === 403 && (msg.includes("rate limit") || msg.includes("abuse"))) {
        return "rate limit (403)";
    }
    return "non-transient";
}
/**
 * Exponential backoff with jitter.
 * Delay = min(base * 2^attempt, maxDelayMs) + jitter (0-25% of computed).
 */
function calculateDelay(attempt, baseDelayMs, maxDelayMs) {
    const raw = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    const jitter = raw * 0.25 * Math.random();
    return Math.floor(raw + jitter);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retries an async operation on transient errors only.
 * Logs attempt number, classification, and delay via logger when retrying.
 */
async function withRetry(fn, config, logger) {
    const baseDelayMs = config.baseDelayMs ?? exports.DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = config.maxDelayMs ?? exports.DEFAULT_MAX_DELAY_MS;
    const log = logger ?? (() => { });
    const maxAttempts = Math.max(1, Number.isFinite(config.maxAttempts) ? config.maxAttempts : 1);
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (e) {
            lastError = e;
            const isLast = attempt === maxAttempts - 1;
            if (isLast || !isTransientError(e)) {
                throw e;
            }
            const classification = classifyError(e);
            const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
            log(`GitHub API attempt ${attempt + 1}/${maxAttempts} failed (${classification}), retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.js.map