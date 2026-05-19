import { z } from "zod";

export const emailSchema = z.email().transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerBodySchema = z.object({
  tenantId: z.uuid(),
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional()
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  tenantId: z.uuid(),
  email: emailSchema,
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().min(1).max(120).optional()
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = z.object({
  csrfToken: z.string().min(32)
});

export type RefreshBody = z.infer<typeof refreshBodySchema>;
