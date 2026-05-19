import {
  domainEventSchema,
  type DomainEvent
} from "@ecommerce/events";
import type { EventLogRepository } from "./event-log.repository.js";

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<string>;
}

export const createDomainEventPublisher = (
  repository: EventLogRepository
): DomainEventPublisher => ({
  async publish(event) {
    const parsed = domainEventSchema.parse(event);
    await repository.append(parsed);
    return parsed.metadata.eventId;
  }
});
