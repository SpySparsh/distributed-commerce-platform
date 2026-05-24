import { z } from "zod";
const uuidSchema = z.uuid();
const isoDateTimeSchema = z.iso.datetime();
export const domainEventNames = {
    orderPlaced: "OrderPlaced",
    paymentCompleted: "PaymentCompleted",
    inventoryReserved: "InventoryReserved",
    cartExpired: "CartExpired",
    productUpdated: "ProductUpdated"
};
export const domainEventMetadataSchema = z.object({
    eventId: uuidSchema,
    tenantId: uuidSchema,
    aggregateId: uuidSchema,
    aggregateType: z.enum(["Order", "Payment", "InventoryReservation", "Cart", "Product"]),
    occurredAt: isoDateTimeSchema,
    correlationId: z.string().min(1).optional(),
    causationId: uuidSchema.optional(),
    actorUserId: uuidSchema.optional(),
    schemaVersion: z.literal(1)
});
export const orderPlacedEventSchema = z.object({
    name: z.literal(domainEventNames.orderPlaced),
    metadata: domainEventMetadataSchema.extend({
        aggregateType: z.literal("Order")
    }),
    payload: z.object({
        orderId: uuidSchema,
        orderNumber: z.string().min(1),
        userId: uuidSchema.optional(),
        cartId: uuidSchema.optional(),
        totalAmount: z.string().min(1),
        currency: z.string().length(3),
        itemCount: z.number().int().positive()
    })
});
export const paymentCompletedEventSchema = z.object({
    name: z.literal(domainEventNames.paymentCompleted),
    metadata: domainEventMetadataSchema.extend({
        aggregateType: z.literal("Payment")
    }),
    payload: z.object({
        paymentId: uuidSchema,
        orderId: uuidSchema,
        provider: z.enum(["stripe", "cod", "manual"]),
        amount: z.string().min(1),
        currency: z.string().length(3),
        providerPaymentId: z.string().min(1).optional()
    })
});
export const inventoryReservedEventSchema = z.object({
    name: z.literal(domainEventNames.inventoryReserved),
    metadata: domainEventMetadataSchema.extend({
        aggregateType: z.literal("InventoryReservation")
    }),
    payload: z.object({
        reservationId: uuidSchema,
        variantId: uuidSchema,
        quantity: z.number().int().positive(),
        expiresAt: isoDateTimeSchema,
        cartItemId: uuidSchema.optional()
    })
});
export const cartExpiredEventSchema = z.object({
    name: z.literal(domainEventNames.cartExpired),
    metadata: domainEventMetadataSchema.extend({
        aggregateType: z.literal("Cart")
    }),
    payload: z.object({
        cartId: uuidSchema,
        userId: uuidSchema.optional(),
        guestId: z.string().min(1).optional(),
        expiredAt: isoDateTimeSchema
    })
});
export const productUpdatedEventSchema = z.object({
    name: z.literal(domainEventNames.productUpdated),
    metadata: domainEventMetadataSchema.extend({
        aggregateType: z.literal("Product")
    }),
    payload: z.object({
        productId: uuidSchema,
        slug: z.string().min(1),
        changedFields: z.array(z.string().min(1)).min(1),
        shouldReindex: z.boolean().default(true)
    })
});
export const domainEventSchema = z.discriminatedUnion("name", [
    orderPlacedEventSchema,
    paymentCompletedEventSchema,
    inventoryReservedEventSchema,
    cartExpiredEventSchema,
    productUpdatedEventSchema
]);
