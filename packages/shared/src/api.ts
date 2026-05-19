import { z } from "zod";
import { appErrorCodeSchema, fieldErrorsSchema } from "./errors";
import type { AppErrorCode } from "./errors";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const createApiSuccessSchema = <TData extends z.ZodType>(dataSchema: TData) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema
  });

export const apiErrorSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string().min(1),
  fieldErrors: fieldErrorsSchema.optional()
});

export const apiFailureSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema
});

export const createApiResultSchema = <TData extends z.ZodType>(dataSchema: TData) =>
  z.discriminatedUnion("ok", [createApiSuccessSchema(dataSchema), apiFailureSchema]);

export interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

export interface ApiFailure<TCode extends string = AppErrorCode> {
  ok: false;
  error: {
    code: TCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export type ApiResult<TData, TCode extends string = string> =
  | ApiSuccess<TData>
  | ApiFailure<TCode>;

export interface PaginatedResult<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const apiSuccess = <TData>(data: TData): ApiSuccess<TData> => ({
  ok: true,
  data
});

export const apiFailure = <TCode extends AppErrorCode>(
  code: TCode,
  message: string,
  fieldErrors?: Record<string, string[]>
): ApiFailure<TCode> => ({
  ok: false,
  error: {
    code,
    message,
    ...(fieldErrors === undefined ? {} : { fieldErrors })
  }
});
