import type { Logger } from "pino";
import type { WorkerJob } from "@ecommerce/queue";

export interface JobHandlerContext {
  readonly logger: Logger;
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
      await logPlannedAsyncWork(job, context, "Email job accepted");
      return;
    case "invoice.generate":
      await logPlannedAsyncWork(job, context, "Invoice generation job accepted");
      return;
    case "analytics.track":
      await logPlannedAsyncWork(job, context, "Analytics job accepted");
      return;
    case "payment.retry":
      await logPlannedAsyncWork(job, context, "Payment retry job accepted");
      return;
    case "stock.sync":
      await logPlannedAsyncWork(job, context, "Stock synchronization job accepted");
      return;
    case "inventory.reservations.releaseExpired":
      await logPlannedAsyncWork(job, context, "Expired inventory reservation cleanup job accepted");
      return;
    case "search.product.index":
      await logPlannedAsyncWork(job, context, "Product search indexing job accepted");
      return;
    case "search.product.delete":
      await logPlannedAsyncWork(job, context, "Product search deletion job accepted");
      return;
    case "search.index.rebuild":
      await logPlannedAsyncWork(job, context, "Search index rebuild job accepted");
      return;
  }
};
