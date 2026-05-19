import { z } from "zod";

export const appErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "PAYMENT_FAILED",
  "INTERNAL_SERVER_ERROR"
]);

export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;

export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()));

export type FieldErrors = z.infer<typeof fieldErrorsSchema>;

export interface AppErrorShape<TCode extends AppErrorCode = AppErrorCode> {
  code: TCode;
  message: string;
  fieldErrors?: FieldErrors;
  cause?: unknown;
}

export class AppError<TCode extends AppErrorCode = AppErrorCode> extends Error {
  override name = "AppError";
  readonly code: TCode;
  readonly fieldErrors?: FieldErrors;
  override readonly cause?: unknown;

  constructor({ code, message, fieldErrors, cause }: AppErrorShape<TCode>) {
    super(message);
    this.code = code;

    if (fieldErrors !== undefined) {
      this.fieldErrors = fieldErrors;
    }

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
