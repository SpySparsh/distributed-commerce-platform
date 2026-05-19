import { z } from "zod";

const uuidSchema = z.uuid();

export const inventoryTenantQuerySchema = z.object({
  tenantId: uuidSchema
});

export const inventoryVariantParamsSchema = z.object({
  variantId: uuidSchema
});

export const inventoryReservationParamsSchema = z.object({
  reservationId: uuidSchema
});

export const reserveInventoryBodySchema = z.object({
  tenantId: uuidSchema,
  variantId: uuidSchema,
  quantity: z.number().int().positive().max(500),
  cartItemId: uuidSchema.optional(),
  idempotencyKey: z.string().min(16).max(128).optional(),
  ttlSeconds: z.number().int().min(60).max(60 * 60).default(15 * 60)
});

export const reservationTenantBodySchema = z.object({
  tenantId: uuidSchema
});

export const consumeReservationBodySchema = z.object({
  tenantId: uuidSchema,
  orderItemId: uuidSchema.optional()
});

export const releaseExpiredReservationsBodySchema = z.object({
  tenantId: uuidSchema.optional(),
  batchSize: z.number().int().min(1).max(1_000).default(100)
});

export type ReserveInventoryBody = z.infer<typeof reserveInventoryBodySchema>;
export type ConsumeReservationBody = z.infer<typeof consumeReservationBodySchema>;
export type ReleaseExpiredReservationsBody = z.infer<typeof releaseExpiredReservationsBodySchema>;
