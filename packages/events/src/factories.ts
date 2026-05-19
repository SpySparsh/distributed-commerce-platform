import { randomUUID } from "node:crypto";
import {
  domainEventNames,
  type CartExpiredEvent,
  type DomainEventMetadata,
  type DomainEventName,
  type InventoryReservedEvent,
  type OrderPlacedEvent,
  type PaymentCompletedEvent,
  type ProductUpdatedEvent
} from "./domain-events.js";

export interface DomainEventContext {
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly actorUserId?: string;
  readonly occurredAt?: Date;
}

const createMetadata = (
  context: DomainEventContext,
  aggregateType: DomainEventMetadata["aggregateType"]
): DomainEventMetadata => ({
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

const createOrderMetadata = (context: DomainEventContext): OrderPlacedEvent["metadata"] => ({
  ...createMetadata(context, "Order"),
  aggregateType: "Order"
});

const createPaymentMetadata = (context: DomainEventContext): PaymentCompletedEvent["metadata"] => ({
  ...createMetadata(context, "Payment"),
  aggregateType: "Payment"
});

const createInventoryReservationMetadata = (
  context: DomainEventContext
): InventoryReservedEvent["metadata"] => ({
  ...createMetadata(context, "InventoryReservation"),
  aggregateType: "InventoryReservation"
});

const createCartMetadata = (context: DomainEventContext): CartExpiredEvent["metadata"] => ({
  ...createMetadata(context, "Cart"),
  aggregateType: "Cart"
});

const createProductMetadata = (context: DomainEventContext): ProductUpdatedEvent["metadata"] => ({
  ...createMetadata(context, "Product"),
  aggregateType: "Product"
});

export const createOrderPlacedEvent = (
  context: DomainEventContext,
  payload: OrderPlacedEvent["payload"]
): OrderPlacedEvent => ({
  name: domainEventNames.orderPlaced,
  metadata: createOrderMetadata(context),
  payload
});

export const createPaymentCompletedEvent = (
  context: DomainEventContext,
  payload: PaymentCompletedEvent["payload"]
): PaymentCompletedEvent => ({
  name: domainEventNames.paymentCompleted,
  metadata: createPaymentMetadata(context),
  payload
});

export const createInventoryReservedEvent = (
  context: DomainEventContext,
  payload: InventoryReservedEvent["payload"]
): InventoryReservedEvent => ({
  name: domainEventNames.inventoryReserved,
  metadata: createInventoryReservationMetadata(context),
  payload
});

export const createCartExpiredEvent = (
  context: DomainEventContext,
  payload: CartExpiredEvent["payload"]
): CartExpiredEvent => ({
  name: domainEventNames.cartExpired,
  metadata: createCartMetadata(context),
  payload
});

export const createProductUpdatedEvent = (
  context: DomainEventContext,
  payload: ProductUpdatedEvent["payload"]
): ProductUpdatedEvent => ({
  name: domainEventNames.productUpdated,
  metadata: createProductMetadata(context),
  payload
});

export const domainEventNameToIdempotencyPrefix = (eventName: DomainEventName): string =>
  `domain-event:${eventName}`;
