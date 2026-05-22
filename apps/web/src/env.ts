import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const webEnvSchema = createEnvSchema({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_TENANT_ID: z.uuid(),
  NEXT_PUBLIC_TENANT_SLUG: z.string().min(1).optional()
});

export type WebEnv = z.infer<typeof webEnvSchema>;
