import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { DomainEvent } from "@ecommerce/events";
import type { Logger } from "pino";

export interface DomainEventConsumerContext {
  readonly logger: Logger;
  readonly queues: QueueProducer;
}

const enqueueAnalytics = (
  event: DomainEvent,
  context: DomainEventConsumerContext
): Promise<string> =>
  context.queues.enqueue({
    name: jobNames.trackAnalytics,
    metadata: {
      tenantId: event.metadata.tenantId,
      idempotencyKey: `analytics:${event.metadata.eventId}`,
      createdAt: new Date().toISOString(),
      ...(event.metadata.correlationId === undefined ? {} : { requestId: event.metadata.correlationId })
    },
    data: {
      event: event.name,
      subjectId: event.metadata.aggregateId,
      properties: {
        eventId: event.metadata.eventId,
        aggregateType: event.metadata.aggregateType,
        schemaVersion: event.metadata.schemaVersion
      }
    }
  });

export const consumeDomainEvent = async (
  event: DomainEvent,
  context: DomainEventConsumerContext
): Promise<void> => {
  context.logger.info(
    {
      eventId: event.metadata.eventId,
      eventName: event.name,
      tenantId: event.metadata.tenantId,
      aggregateId: event.metadata.aggregateId
    },
    "Consuming domain event"
  );

  switch (event.name) {
    case "OrderPlaced":
      await context.queues.enqueue({
        name: jobNames.generateInvoice,
        metadata: {
          tenantId: event.metadata.tenantId,
          idempotencyKey: `invoice:${event.payload.orderId}`,
          createdAt: new Date().toISOString(),
          ...(event.metadata.correlationId === undefined ? {} : { requestId: event.metadata.correlationId })
        },
        data: {
          orderId: event.payload.orderId,
          ...(event.payload.userId === undefined ? {} : { userId: event.payload.userId })
        }
      });
      await enqueueAnalytics(event, context);
      return;

    case "PaymentCompleted":
      await context.queues.enqueue({
        name: jobNames.trackAnalytics,
        metadata: {
          tenantId: event.metadata.tenantId,
          idempotencyKey: `payment-completed:${event.payload.paymentId}`,
          createdAt: new Date().toISOString(),
          ...(event.metadata.correlationId === undefined ? {} : { requestId: event.metadata.correlationId })
        },
        data: {
          event: event.name,
          subjectId: event.payload.orderId,
          properties: {
            paymentId: event.payload.paymentId,
            provider: event.payload.provider,
            amount: event.payload.amount,
            currency: event.payload.currency
          }
        }
      });
      return;

    case "InventoryReserved":
      await enqueueAnalytics(event, context);
      return;

    case "CartExpired":
      await enqueueAnalytics(event, context);
      return;

    case "ProductUpdated":
      if (event.payload.shouldReindex) {
        await context.queues.enqueue({
          name: jobNames.indexProductSearchDocument,
          metadata: {
            tenantId: event.metadata.tenantId,
            idempotencyKey: `search-index-product:${event.payload.productId}:${event.metadata.eventId}`,
            createdAt: new Date().toISOString(),
            ...(event.metadata.correlationId === undefined ? {} : { requestId: event.metadata.correlationId })
          },
          data: {
            productId: event.payload.productId
          }
        });
      }
      await enqueueAnalytics(event, context);
      return;
  }
};
