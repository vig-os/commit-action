/** Default max attempts (1 = no retries, backward compatible). */
export const DEFAULT_MAX_ATTEMPTS = 1;

/** Default base delay for exponential backoff, in milliseconds. */
export const DEFAULT_BASE_DELAY_MS = 1000;

/** Default maximum delay cap for backoff, in milliseconds. */
export const DEFAULT_MAX_DELAY_MS = 30_000;

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/** HTTP-like error shape from Octokit RequestError. */
function hasStatus(e: unknown): e is { status: number; message?: string } {
  return typeof e === "object" && e !== null && "status" in e;
}

/**
 * Returns true if the error is a transient condition worth retrying:
 * - 404 (transient ref/commit lookup)
 * - 5xx (server error)
 * - 429 (primary rate limit)
 * - 403 with rate limit / secondary rate limit / abuse in message
 */
export function isTransientError(error: unknown): boolean {
  if (!hasStatus(error)) return false;
  const { status, message = "" } = error;
  const msg = message.toLowerCase();

  if (status === 404) return true;
  if (status >= 500 && status < 600) return true;
  if (status === 429) return true;
  if (status === 403) {
    return (
      msg.includes("rate limit") ||
      msg.includes("secondary rate limit") ||
      msg.includes("abuse")
    );
  }
  return false;
}

/** Human-readable classification for logging. */
export function classifyError(error: unknown): string {
  if (!hasStatus(error)) return "non-transient";
  const { status, message = "" } = error;
  const msg = message.toLowerCase();

  if (status === 404) return "HTTP 404 (transient)";
  if (status >= 500 && status < 600) return `HTTP ${status} (server error)`;
  if (status === 429) return "HTTP 429 (rate limit)";
  if (status === 403 && (msg.includes("rate limit") || msg.includes("abuse"))) {
    return "rate limit (403)";
  }
  return "non-transient";
}

/**
 * Exponential backoff with jitter.
 * Delay = min(base * 2^attempt, maxDelayMs) + jitter (0-25% of computed).
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const raw = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  const jitter = raw * 0.25 * Math.random();
  return Math.floor(raw + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation on transient errors only.
 * Logs attempt number, classification, and delay via logger when retrying.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  logger?: (msg: string) => void
): Promise<T> {
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const log = logger ?? (() => {});

  let lastError: unknown;
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isLast = attempt === config.maxAttempts - 1;
      if (isLast || !isTransientError(e)) {
        throw e;
      }
      const classification = classifyError(e);
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      log(
        `GitHub API attempt ${attempt + 1}/${config.maxAttempts} failed (${classification}), retrying in ${delay}ms`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
