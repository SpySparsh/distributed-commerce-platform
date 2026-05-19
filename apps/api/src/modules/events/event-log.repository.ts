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

export interface PublishableDomainEventLogRecord extends DomainEventLogRecord {
  readonly event: DomainEvent;
}

export interface EventLogRepository {
  append(event: DomainEvent): Promise<DomainEventLogRecord>;
  findPublishable(limit: number): Promise<readonly PublishableDomainEventLogRecord[]>;
  markPublished(eventId: string): Promise<void>;
  markConsumed(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
}
