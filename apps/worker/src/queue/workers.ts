import { QueueEvents, Worker, type ConnectionOptions, type Job } from "bullmq";
import {
  createQueueProducer,
  ecommerceJobSchema,
  queueNames,
  type QueueName,
  type WorkerJob
} from "@ecommerce/queue";
import type { Logger } from "pino";
import { handleWorkerJob } from "../jobs/handlers.js";
import { enqueueDeadLetter } from "./dead-letter.js";

export interface WorkerRuntime {
  readonly workers: readonly Worker[];
  readonly events: readonly QueueEvents[];
  close(): Promise<void>;
}

const workerQueueNames = [
  queueNames.email,
  queueNames.invoice,
  queueNames.analytics,
  queueNames.paymentRetry,
  queueNames.stockSync,
  queueNames.inventory,
  queueNames.search
] satisfies readonly QueueName[];

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown worker error";

export const createWorkers = (
  connection: ConnectionOptions,
  concurrency: number,
  logger: Logger
): WorkerRuntime => {
  const producer = createQueueProducer(connection);

  const workers = workerQueueNames.map(
    (queueName) =>
      new Worker(
        queueName,
        async (bullJob: Job) => {
          const parsed = ecommerceJobSchema.parse(bullJob.data);

          if (parsed.name === "dead-letter.record") {
            return;
          }

          await handleWorkerJob(parsed as WorkerJob, {
            logger
          });
        },
        {
          connection,
          concurrency
        }
      )
  );

  const events = workerQueueNames.map((queueName) => {
    const queueEvents = new QueueEvents(queueName, { connection });

    queueEvents.on("completed", ({ jobId }) => {
      logger.info({ queueName, jobId }, "Job completed");
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.error({ queueName, jobId, failedReason }, "Job failed");
    });

    return queueEvents;
  });

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      logger.error(
        {
          queueName: worker.name,
          jobId: job?.id,
          error
        },
        "Worker job failed"
      );

      if (job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        const parsed = ecommerceJobSchema.safeParse(job.data);

        if (parsed.success && parsed.data.name !== "dead-letter.record") {
          void enqueueDeadLetter(producer, {
            tenantId: parsed.data.metadata.tenantId,
            originalQueue: worker.name,
            originalJobName: parsed.data.name,
            ...(job.id === undefined ? {} : { originalJobId: job.id }),
            reason: getErrorMessage(error),
            payload: parsed.data
          });
        }
      }
    });
  }

  return {
    workers,
    events,
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(events.map((queueEvents) => queueEvents.close()));
      await producer.close();
    }
  };
};
