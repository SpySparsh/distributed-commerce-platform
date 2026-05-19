import pino, { type LoggerOptions } from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

export interface LogContext {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly userId?: string;
  readonly jobId?: string;
  readonly tenantId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export interface ServiceLoggerOptions {
  readonly serviceName: string;
  readonly environment: string;
  readonly level: LogLevel;
}

export const redactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.accessToken",
  "*.refreshToken"
] as const;

export const createPinoOptions = ({
  serviceName,
  environment,
  level
}: ServiceLoggerOptions): LoggerOptions => ({
  level,
  base: {
    service: serviceName,
    environment
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [...redactionPaths],
    remove: true
  },
  formatters: {
    level(label) {
      return {
        level: label
      };
    }
  }
});

export const createServiceLogger = (options: ServiceLoggerOptions) =>
  pino(createPinoOptions(options));
