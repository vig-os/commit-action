/** Default max attempts (1 = no retries, backward compatible). */
export declare const DEFAULT_MAX_ATTEMPTS = 1;
/** Default base delay for exponential backoff, in milliseconds. */
export declare const DEFAULT_BASE_DELAY_MS = 1000;
/** Default maximum delay cap for backoff, in milliseconds. */
export declare const DEFAULT_MAX_DELAY_MS = 30000;
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}
/**
 * Returns true if the error is a transient condition worth retrying:
 * - 404 (transient ref/commit lookup)
 * - 5xx (server error)
 * - 429 (primary rate limit)
 * - 403 with rate limit / secondary rate limit / abuse in message
 */
export declare function isTransientError(error: unknown): boolean;
/** Human-readable classification for logging. */
export declare function classifyError(error: unknown): string;
/**
 * Exponential backoff with jitter.
 * Delay = min(base * 2^attempt, maxDelayMs) + jitter (0-25% of computed).
 */
export declare function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
/**
 * Retries an async operation on transient errors only.
 * Logs attempt number, classification, and delay via logger when retrying.
 */
export declare function withRetry<T>(fn: () => Promise<T>, config: RetryConfig, logger?: (msg: string) => void): Promise<T>;
//# sourceMappingURL=retry.d.ts.map