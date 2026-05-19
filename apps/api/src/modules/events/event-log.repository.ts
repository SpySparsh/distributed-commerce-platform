import type { DomainEvent } from "@ecommerce/events";

export type DomainEventLogStatus = "pending" | "published" | "consumed" | "failed";

export interface DomainEventLogRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly status: DomainEventLogStatus;
  readonly occurredAt: string;
  readonly publishedAt?: string;
  readonly consumedAt?: string;
  readonly failedAt?: string;
  readonly failureReason?: string;
}

export interface EventLogRepository {
  append(event: DomainEvent): Promise<DomainEventLogRecord>;
  markPublished(eventId: string): Promise<void>;
  markConsumed(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
}

export class UnconfiguredEventLogRepository implements EventLogRepository {
  async append(event: DomainEvent): Promise<DomainEventLogRecord> {
    return {
      id: event.metadata.eventId,
      tenantId: event.metadata.tenantId,
      name: event.name,
      aggregateType: event.metadata.aggregateType,
      aggregateId: event.metadata.aggregateId,
      status: "pending",
      occurredAt: event.metadata.occurredAt
    };
  }

  async markPublished(): Promise<void> {}

  async markConsumed(): Promise<void> {}

  async markFailed(): Promise<void> {}
}
