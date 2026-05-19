import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const webEnvSchema = createEnvSchema({
  NEXT_PUBLIC_API_URL: z.url()
});

export type WebEnv = z.infer<typeof webEnvSchema>;
