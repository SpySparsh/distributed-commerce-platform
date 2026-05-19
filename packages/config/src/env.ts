import { z } from "zod";

export const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export const createEnvSchema = <TShape extends z.ZodRawShape>(shape: TShape) =>
  runtimeEnvSchema.extend(shape);

export const parseEnv = <TSchema extends z.ZodType>(
  schema: TSchema,
  env: Record<string, string | undefined>
): z.output<TSchema> => schema.parse(env);
