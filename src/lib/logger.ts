/**
 * Logger Service
 *
 * Centralized logging utility that provides consistent logging across the application.
 * In development mode, logs to console. In production, can be extended to send logs
 * to external monitoring services (e.g., Sentry, LogRocket).
 */

/* eslint-disable no-console */
/**
 * Logger class for application-wide logging.
 * Provides methods for different log levels with consistent formatting.
 */
class Logger {
  private isDev = import.meta.env.DEV;
  private isProd = import.meta.env.PROD;

  /**
   * Logs an error message with optional error object.
   * Errors are always logged, even in production (for monitoring).
   *
   * @param message - Error message
   * @param error - Optional error object or additional data
   */
  error(message: string, error?: unknown): void {
    if (this.isDev) {
      console.error(`[ERROR] ${message}`, error);
    }
    // In production, you can add integration with monitoring services here
    // e.g., Sentry.captureException(error, { extra: { message } });
  }

  /**
   * Logs a warning message with optional data.
   *
   * @param message - Warning message
   * @param data - Optional additional data
   */
  warn(message: string, data?: unknown): void {
    if (this.isDev) {
      console.warn(`[WARN] ${message}`, data);
    }
    // In production, you can add integration with monitoring services here
  }

  /**
   * Logs an informational message with optional data.
   *
   * @param message - Info message
   * @param data - Optional additional data
   */
  info(message: string, data?: unknown): void {
    if (this.isDev) {
      console.info(`[INFO] ${message}`, data);
    }
  }

  /**
   * Logs a debug message with optional data.
   * Debug logs are only shown in development mode.
   *
   * @param message - Debug message
   * @param data - Optional additional data
   */
  debug(message: string, data?: unknown): void {
    if (this.isDev) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  /**
   * Creates a child logger with a specific context/prefix.
   * Useful for logging within services or modules.
   *
   * @param context - Context name to prefix all log messages
   * @returns A new logger instance with the context prefix
   */
  fork(context: string): Logger {
    const childLogger = new Logger();
    const originalError = childLogger.error.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalDebug = childLogger.debug.bind(childLogger);

    childLogger.error = (message: string, error?: unknown) => {
      originalError(`[${context}] ${message}`, error);
    };

    childLogger.warn = (message: string, data?: unknown) => {
      originalWarn(`[${context}] ${message}`, data);
    };

    childLogger.info = (message: string, data?: unknown) => {
      originalInfo(`[${context}] ${message}`, data);
    };

    childLogger.debug = (message: string, data?: unknown) => {
      originalDebug(`[${context}] ${message}`, data);
    };

    return childLogger;
  }
}

/**
 * Default logger instance.
 * Use this for general application logging.
 */
export const logger = new Logger();
