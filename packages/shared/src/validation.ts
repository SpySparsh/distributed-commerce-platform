import { z } from "zod";
import type { FieldErrors } from "./errors";

export type SchemaInput<TSchema extends z.ZodType> = z.input<TSchema>;

export type SchemaOutput<TSchema extends z.ZodType> = z.output<TSchema>;

export const toFieldErrors = (error: z.ZodError): FieldErrors =>
  error.issues.reduce<FieldErrors>((fieldErrors, issue) => {
    const path = issue.path.join(".") || "root";
    const messages = fieldErrors[path] ?? [];
    return {
      ...fieldErrors,
      [path]: [...messages, issue.message]
    };
  }, {});

export const parseWithSchema = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown
): SchemaOutput<TSchema> => schema.parse(value);
