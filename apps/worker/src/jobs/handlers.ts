import type { Logger } from "pino";
import type { PrismaClient } from "@ecommerce/database";
import type { QueueProducer, WorkerJob } from "@ecommerce/queue";
import type { EcommerceSearchClient } from "@ecommerce/search";
import { domainEventSchema } from "@ecommerce/events";
import type { WorkerEnv } from "../env.js";
import { consumeDomainEvent } from "./domain-event-consumers.js";
import { handleEmailJob } from "./email.js";
import { handleInventoryCleanupJob } from "./inventory-cleanup.js";
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
      await consumeDomainEvent(domainEventSchema.parse(job.data.event), context);
      return;
  }
};
