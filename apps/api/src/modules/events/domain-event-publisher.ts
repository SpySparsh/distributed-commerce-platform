import {
  domainEventNameToIdempotencyPrefix,
  domainEventSchema,
  type DomainEvent
} from "@ecommerce/events";
import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { EventLogRepository } from "./event-log.repository.js";

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<string>;
}

export const createDomainEventPublisher = (
  repository: EventLogRepository,
  queues: QueueProducer
): DomainEventPublisher => ({
  async publish(event) {
    const parsed = domainEventSchema.parse(event);
    await repository.append(parsed);

    const jobId = await queues.enqueue({
      name: jobNames.dispatchDomainEvent,
      metadata: {
        tenantId: parsed.metadata.tenantId,
        idempotencyKey: `${domainEventNameToIdempotencyPrefix(parsed.name)}:${parsed.metadata.eventId}`,
        createdAt: new Date().toISOString(),
        ...(parsed.metadata.correlationId === undefined ? {} : { requestId: parsed.metadata.correlationId })
      },
      data: {
        event: parsed
      }
    });

    await repository.markPublished(parsed.metadata.eventId);
    return jobId;
  }
});
