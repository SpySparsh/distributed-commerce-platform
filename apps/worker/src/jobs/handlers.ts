import type { Logger } from "pino";
import type { PrismaClient } from "@ecommerce/database";
import type { QueueProducer, WorkerJob } from "@ecommerce/queue";
import type { EcommerceSearchClient } from "@ecommerce/search";
import { domainEventSchema } from "@ecommerce/events";
import type { WorkerEnv } from "../env.js";
import { consumeDomainEvent } from "./domain-event-consumers.js";
import { handleEmailJob } from "./email.js";
import { handleInventoryCleanupJob } from "./inventory-cleanup.js";
import { handleInventoryReconciliationJob } from "./inventory-reconciliation.js";
import { handlePaymentRetryJob } from "./payment-retry.js";
import {
  handleProductDeleteJob,
  handleProductIndexJob,
  handleSearchRebuildJob
} from "./search-indexing.js";

export interface JobHandlerContext {
  readonly logger: Logger;
  readonly queues: QueueProducer;
  readonly prisma: PrismaClient;
  readonly search: EcommerceSearchClient;
  readonly env: WorkerEnv;
}

export type JobHandler<TJob extends WorkerJob = WorkerJob> = (
  job: TJob,
  context: JobHandlerContext
) => Promise<void>;

const logPlannedAsyncWork = async (
  job: WorkerJob,
  context: JobHandlerContext,
  activity: string
): Promise<void> => {
  context.logger.info(
    {
      jobName: job.name,
      tenantId: job.metadata.tenantId,
      idempotencyKey: job.metadata.idempotencyKey
    },
    activity
  );
};

export const handleWorkerJob = async (
  job: WorkerJob,
  context: JobHandlerContext
): Promise<void> => {
  switch (job.name) {
    case "email.send":
      await handleEmailJob(job, context);
      return;
    case "invoice.generate":
      await logPlannedAsyncWork(job, context, "Invoice generation job accepted");
      return;
    case "analytics.track":
      await logPlannedAsyncWork(job, context, "Analytics job accepted");
      return;
    case "payment.retry":
      await handlePaymentRetryJob(job, context);
      return;
    case "stock.sync":
      await logPlannedAsyncWork(job, context, "Stock synchronization job accepted");
      return;
    case "inventory.reservations.releaseExpired":
      await handleInventoryCleanupJob(job, context);
      return;
    case "inventory.reservations.reconcile":
      await handleInventoryReconciliationJob(job, context);
      return;
    case "search.product.index":
      await handleProductIndexJob(job, context);
      return;
    case "search.product.delete":
      await handleProductDeleteJob(job, context);
      return;
    case "search.index.rebuild":
      await handleSearchRebuildJob(job, context);
      return;
    case "domain-event.dispatch":
      {
        const event = domainEventSchema.parse(job.data.event);

        try {
          await consumeDomainEvent(event, context);
          await context.prisma.domainEventLog.updateMany({
            where: {
              id: event.metadata.eventId,
              status: {
                in: ["pending", "published", "failed"]
              }
            },
            data: {
              status: "consumed",
              consumedAt: new Date(),
              failureReason: null
            }
          });
        } catch (error) {
          await context.prisma.domainEventLog.updateMany({
            where: {
              id: event.metadata.eventId,
              status: {
                not: "consumed"
              }
            },
            data: {
              status: "failed",
              failedAt: new Date(),
              failureReason: error instanceof Error ? error.message : "Unknown domain event consumer error"
            }
          });
          throw error;
        }
      }
      return;
  }
};
