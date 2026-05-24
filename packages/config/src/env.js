import { z } from "zod";
export const runtimeEnvSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});
export const createEnvSchema = (shape) => runtimeEnvSchema.extend(shape);
export const parseEnv = (schema, env) => {
    const normalizedEnv = Object.fromEntries(Object.entries(env).map(([key, value]) => [
        key,
        value === "" ? undefined : value
    ]));
    return schema.parse(normalizedEnv);
};
