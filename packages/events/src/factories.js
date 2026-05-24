import { randomUUID } from "node:crypto";
import { domainEventNames } from "./domain-events.js";
const createMetadata = (context, aggregateType) => ({
    eventId: randomUUID(),
    tenantId: context.tenantId,
    aggregateId: context.aggregateId,
    aggregateType,
    occurredAt: (context.occurredAt ?? new Date()).toISOString(),
    ...(context.correlationId === undefined ? {} : { correlationId: context.correlationId }),
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    ...(context.actorUserId === undefined ? {} : { actorUserId: context.actorUserId }),
    schemaVersion: 1
});
const createOrderMetadata = (context) => ({
    ...createMetadata(context, "Order"),
    aggregateType: "Order"
});
const createPaymentMetadata = (context) => ({
    ...createMetadata(context, "Payment"),
    aggregateType: "Payment"
});
const createInventoryReservationMetadata = (context) => ({
    ...createMetadata(context, "InventoryReservation"),
    aggregateType: "InventoryReservation"
});
const createCartMetadata = (context) => ({
    ...createMetadata(context, "Cart"),
    aggregateType: "Cart"
});
const createProductMetadata = (context) => ({
    ...createMetadata(context, "Product"),
    aggregateType: "Product"
});
export const createOrderPlacedEvent = (context, payload) => ({
    name: domainEventNames.orderPlaced,
    metadata: createOrderMetadata(context),
    payload
});
export const createPaymentCompletedEvent = (context, payload) => ({
    name: domainEventNames.paymentCompleted,
    metadata: createPaymentMetadata(context),
    payload
});
export const createInventoryReservedEvent = (context, payload) => ({
    name: domainEventNames.inventoryReserved,
    metadata: createInventoryReservationMetadata(context),
    payload
});
export const createCartExpiredEvent = (context, payload) => ({
    name: domainEventNames.cartExpired,
    metadata: createCartMetadata(context),
    payload
});
export const createProductUpdatedEvent = (context, payload) => ({
    name: domainEventNames.productUpdated,
    metadata: createProductMetadata(context),
    payload
});
export const domainEventNameToIdempotencyPrefix = (eventName) => `domain-event:${eventName}`;
