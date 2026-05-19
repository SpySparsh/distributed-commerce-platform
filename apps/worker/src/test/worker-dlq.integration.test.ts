import { Queue } from "bullmq";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jobNames, queueNames } from "@ecommerce/queue";
import { createWorkers, type WorkerRuntime } from "../queue/workers.js";
import type { WorkerEnv } from "../env.js";

const runIntegration = process.env["RUN_INTEGRATION"] === "true";
const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:56379/15";

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("Timed out waiting for worker assertion");
};

describe.skipIf(!runIntegration)("worker retry and DLQ integration", () => {
  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null
  };
  const logger = pino({ level: "silent" });
  const env: WorkerEnv = {
    NODE_ENV: "test",
    DATABASE_URL: process.env["DATABASE_URL"] ?? "postgresql://ecommerce:ecommerce@localhost:55432/ecommerce_test?schema=public",
    REDIS_URL: redisUrl,
    MEILISEARCH_HOST: "http://localhost:7700",
    MEILISEARCH_API_KEY: "development-master-key",
    MEILISEARCH_INDEX_PREFIX: "test",
    WORKER_CONCURRENCY: 1,
    WORKER_SHUTDOWN_GRACE_MS: 1000
  };
  let runtime: WorkerRuntime;
  let domainQueue: Queue;
  let deadLetterQueue: Queue;

  beforeAll(async () => {
    domainQueue = new Queue(queueNames.domainEvents, { connection });
    deadLetterQueue = new Queue(queueNames.deadLetter, { connection });
    await domainQueue.drain(true);
    await deadLetterQueue.drain(true);
    runtime = createWorkers(
      connection,
      {} as Parameters<typeof createWorkers>[1],
      {} as Parameters<typeof createWorkers>[2],
      env,
      1,
      logger
    );
  });

  afterAll(async () => {
    await runtime.close();
    await domainQueue.close();
    await deadLetterQueue.close();
  });

  it("moves an exhausted failed worker job to the dead-letter queue", async () => {
    await domainQueue.add(
      jobNames.dispatchDomainEvent,
      {
        name: jobNames.dispatchDomainEvent,
        metadata: {
          tenantId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "domain-event-invalid-payload",
          createdAt: new Date().toISOString()
        },
        data: {
          event: {
            name: "PaymentCompleted",
            metadata: {
              eventId: "not-a-uuid"
            },
            payload: {}
          }
        }
      },
      {
        jobId: "domain-event-invalid-payload",
        attempts: 1,
        removeOnFail: false
      }
    );

    await waitFor(async () => {
      const jobs = await deadLetterQueue.getJobs(["waiting", "delayed", "completed", "failed"]);
      return jobs.some((job) => job.name === jobNames.deadLetter);
    });

    const jobs = await deadLetterQueue.getJobs(["waiting", "delayed", "completed", "failed"]);
    const deadLetter = jobs.find((job) => job.name === jobNames.deadLetter);

    expect(deadLetter?.data.data.originalJobName).toBe(jobNames.dispatchDomainEvent);
    expect(deadLetter?.data.data.originalQueue).toBe(queueNames.domainEvents);
  });
});
