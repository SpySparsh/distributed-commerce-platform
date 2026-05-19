import type { PrismaClient } from "@ecommerce/database";
import {
  domainEventNameToIdempotencyPrefix,
  domainEventSchema,
  type DomainEvent
} from "@ecommerce/events";
import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { Logger } from "pino";

interface DomainEventLogRow {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly actorUserId: string | null;
  readonly schemaVersion: number;
  readonly payload: unknown;
  readonly occurredAt: Date;
}

export interface DomainEventOutboxDispatcher {
  dispatchPending(): Promise<void>;
  close(): void;
}

const toDomainEvent = (row: DomainEventLogRow): DomainEvent =>
  domainEventSchema.parse({
    name: row.name,
    metadata: {
      eventId: row.id,
      tenantId: row.tenantId,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      occurredAt: row.occurredAt.toISOString(),
      ...(row.correlationId === null ? {} : { correlationId: row.correlationId }),
      ...(row.causationId === null ? {} : { causationId: row.causationId }),
      ...(row.actorUserId === null ? {} : { actorUserId: row.actorUserId }),
      schemaVersion: row.schemaVersion
    },
    payload: row.payload
  });

export const createDomainEventOutboxDispatcher = (
  prisma: PrismaClient,
  queues: QueueProducer,
  logger: Logger,
  options: {
    readonly batchSize: number;
    readonly intervalMs: number;
  }
): DomainEventOutboxDispatcher => {
  let isRunning = false;

  const dispatchPending = async (): Promise<void> => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const rows = await prisma.domainEventLog.findMany({
        where: {
          status: "pending",
          deletedAt: null
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        take: options.batchSize
      });

      for (const row of rows) {
        let event: DomainEvent;

        try {
          event = toDomainEvent(row);
        } catch (error) {
          await prisma.domainEventLog.updateMany({
            where: {
              id: row.id,
              status: "pending"
            },
            data: {
              status: "failed",
              failedAt: new Date(),
              failureReason: error instanceof Error ? error.message : "Invalid domain event payload"
            }
          });
          logger.error({ eventId: row.id, error }, "Domain event outbox row is invalid");
          continue;
        }

        try {
          const jobId = await queues.enqueue({
            name: jobNames.dispatchDomainEvent,
            metadata: {
              tenantId: event.metadata.tenantId,
              idempotencyKey: `${domainEventNameToIdempotencyPrefix(event.name)}:${event.metadata.eventId}`,
              createdAt: new Date().toISOString(),
              ...(event.metadata.correlationId === undefined
                ? {}
                : { requestId: event.metadata.correlationId })
            },
            data: {
              event
            }
          });

          await prisma.domainEventLog.updateMany({
            where: {
              id: event.metadata.eventId,
              status: "pending"
            },
            data: {
              status: "published",
              publishedAt: new Date()
            }
          });

          logger.info(
            {
              eventId: event.metadata.eventId,
              eventName: event.name,
              tenantId: event.metadata.tenantId,
              jobId
            },
            "Published domain event from outbox"
          );
        } catch (error) {
          logger.error(
            {
              eventId: event.metadata.eventId,
              eventName: event.name,
              tenantId: event.metadata.tenantId,
              error
            },
            "Failed to publish domain event from outbox"
          );
        }
      }
    } finally {
      isRunning = false;
    }
  };

  const interval = setInterval(() => {
    dispatchPending().catch((error: unknown) => {
      logger.error({ error }, "Domain event outbox dispatcher failed");
    });
  }, options.intervalMs);

  interval.unref();

  return {
    dispatchPending,
    close() {
      clearInterval(interval);
    }
  };
};
