import { z } from "zod";

export type SchemaInput<TSchema extends z.ZodType> = z.input<TSchema>;

export type SchemaOutput<TSchema extends z.ZodType> = z.output<TSchema>;

export const entityIdSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type FieldErrors = Record<string, readonly string[]>;

export class RequestValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;
  readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors) {
    super("Request validation failed");
    this.name = "RequestValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export const formatZodError = (error: z.ZodError): FieldErrors =>
  error.issues.reduce<FieldErrors>((fieldErrors, issue) => {
    const field = issue.path.join(".") || "root";
    return {
      ...fieldErrors,
      [field]: [...(fieldErrors[field] ?? []), issue.message]
    };
  }, {});

export const sanitizeString = (value: string): string =>
  value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

export const sanitizeInput = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeInput(nestedValue)])
    );
  }

  return value;
};

export const parseWithSchema = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown
): z.output<TSchema> => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new RequestValidationError(formatZodError(parsed.error));
  }

  return parsed.data;
};
