/**
 * Structured logging utility for API routes.
 * Provides consistent log format with request context.
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  route: string;
  method?: string;
  userId?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, context: LogContext, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${context.route}]`;
  const userStr = context.userId ? ` user=${context.userId}` : "";
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  return `${timestamp} ${level.toUpperCase()} ${prefix}${userStr} ${message}${dataStr}`;
}

export function createLogger(route: string) {
  return {
    info(message: string, data?: Record<string, unknown>) {
      const ctx: LogContext = { route, ...data };
      console.log(formatLog("info", ctx, message, data));
    },
    warn(message: string, data?: Record<string, unknown>) {
      const ctx: LogContext = { route, ...data };
      console.warn(formatLog("warn", ctx, message, data));
    },
    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      const ctx: LogContext = { route, ...data };
      const errorInfo = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(formatLog("error", ctx, message, { ...data, error: errorInfo }));
    },
    /** Create a child logger with additional context (e.g., userId) */
    withContext(extra: Record<string, unknown>) {
      const childRoute = route;
      return {
        info(message: string, data?: Record<string, unknown>) {
          const ctx: LogContext = { route: childRoute, ...extra, ...data };
          console.log(formatLog("info", ctx, message, { ...extra, ...data }));
        },
        warn(message: string, data?: Record<string, unknown>) {
          const ctx: LogContext = { route: childRoute, ...extra, ...data };
          console.warn(formatLog("warn", ctx, message, { ...extra, ...data }));
        },
        error(message: string, error?: unknown, data?: Record<string, unknown>) {
          const ctx: LogContext = { route: childRoute, ...extra, ...data };
          const errorInfo = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
          console.error(formatLog("error", ctx, message, { ...extra, ...data, error: errorInfo }));
        },
      };
    },
  };
}
