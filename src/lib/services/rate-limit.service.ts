/**
 * Rate Limit Service
 *
 * Tracks user requests within a time window to enforce rate limiting.
 * Uses in-memory cache (Map) for simplicity and performance.
 * Suitable for small to medium scale applications.
 *
 * Note: This implementation loses state on server restart.
 * For production at scale, consider using Redis or a database-backed solution.
 */

interface RequestRecord {
  timestamps: number[];
}

export class RateLimitService {
  private readonly requestHistory = new Map<string, RequestRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup of old entries (every 5 minutes)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Checks if a user has exceeded the rate limit within the specified time window.
   *
   * @param userId - User ID to check
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if limit is exceeded, false otherwise
   */
  checkRateLimit(userId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;

    // Get or create request history for user
    let record = this.requestHistory.get(userId);
    if (!record) {
      record = { timestamps: [] };
      this.requestHistory.set(userId, record);
    }

    // Filter out timestamps outside the window
    record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

    // Check if limit is exceeded
    return record.timestamps.length >= limit;
  }

  /**
   * Records a request for a user.
   * Should be called after a successful rate limit check.
   *
   * @param userId - User ID to record request for
   */
  recordRequest(userId: string): void {
    const now = Date.now();
    let record = this.requestHistory.get(userId);
    if (!record) {
      record = { timestamps: [] };
      this.requestHistory.set(userId, record);
    }

    record.timestamps.push(now);
  }

  /**
   * Gets the number of requests remaining for a user within the time window.
   *
   * @param userId - User ID to check
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Number of requests remaining (0 if limit exceeded)
   */
  getRemainingRequests(userId: string, limit: number, windowMs: number): number {
    const now = Date.now();
    const cutoff = now - windowMs;

    const record = this.requestHistory.get(userId);
    if (!record) {
      return limit;
    }

    // Filter out timestamps outside the window
    const validTimestamps = record.timestamps.filter((ts) => ts > cutoff);
    const used = validTimestamps.length;

    return Math.max(0, limit - used);
  }

  /**
   * Cleans up old entries that are outside any reasonable time window.
   * Removes entries for users with no recent requests (older than 1 hour).
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [userId, record] of this.requestHistory.entries()) {
      // Remove timestamps older than maxAge
      record.timestamps = record.timestamps.filter((ts) => ts > now - maxAge);

      // Remove user entry if no timestamps remain
      if (record.timestamps.length === 0) {
        this.requestHistory.delete(userId);
      }
    }
  }

  /**
   * Clears all rate limit data.
   * Useful for testing or manual cleanup.
   */
  clear(): void {
    this.requestHistory.clear();
  }

  /**
   * Stops the cleanup interval.
   * Should be called when shutting down the service.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance for use across the application
export const rateLimitService = new RateLimitService();
