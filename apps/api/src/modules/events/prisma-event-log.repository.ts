import type { PrismaClient } from "@ecommerce/database";
import type { DomainEvent } from "@ecommerce/events";
import type {
  DomainEventLogRecord,
  DomainEventLogStatus,
  EventLogRepository
} from "./event-log.repository.js";

interface DomainEventLogRow {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly status: DomainEventLogStatus;
  readonly occurredAt: Date;
  readonly publishedAt: Date | null;
  readonly consumedAt: Date | null;
  readonly failedAt: Date | null;
  readonly failureReason: string | null;
}

const toLogRecord = (row: DomainEventLogRow): DomainEventLogRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  name: row.name,
  aggregateType: row.aggregateType,
  aggregateId: row.aggregateId,
  status: row.status,
  occurredAt: row.occurredAt.toISOString(),
  ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt.toISOString() }),
  ...(row.consumedAt === null ? {} : { consumedAt: row.consumedAt.toISOString() }),
  ...(row.failedAt === null ? {} : { failedAt: row.failedAt.toISOString() }),
  ...(row.failureReason === null ? {} : { failureReason: row.failureReason })
});

export class PrismaEventLogRepository implements EventLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(event: DomainEvent): Promise<DomainEventLogRecord> {
    const row = await this.prisma.domainEventLog.create({
      data: {
        id: event.metadata.eventId,
        tenantId: event.metadata.tenantId,
        name: event.name,
        aggregateType: event.metadata.aggregateType,
        aggregateId: event.metadata.aggregateId,
        ...(event.metadata.correlationId === undefined ? {} : { correlationId: event.metadata.correlationId }),
        ...(event.metadata.causationId === undefined ? {} : { causationId: event.metadata.causationId }),
        ...(event.metadata.actorUserId === undefined ? {} : { actorUserId: event.metadata.actorUserId }),
        schemaVersion: event.metadata.schemaVersion,
        payload: event.payload,
        occurredAt: new Date(event.metadata.occurredAt)
      }
    });

    return toLogRecord(row);
  }

  async markPublished(eventId: string): Promise<void> {
    await this.prisma.domainEventLog.update({
      where: { id: eventId },
      data: {
        status: "published",
        publishedAt: new Date()
      }
    });
  }

  async markConsumed(eventId: string): Promise<void> {
    await this.prisma.domainEventLog.update({
      where: { id: eventId },
      data: {
        status: "consumed",
        consumedAt: new Date()
      }
    });
  }

  async markFailed(eventId: string, reason: string): Promise<void> {
    await this.prisma.domainEventLog.update({
      where: { id: eventId },
      data: {
        status: "failed",
        failedAt: new Date(),
        failureReason: reason
      }
    });
  }
}
