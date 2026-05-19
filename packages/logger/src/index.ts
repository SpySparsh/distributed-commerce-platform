export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly jobId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
