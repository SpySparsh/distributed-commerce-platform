import { createIdempotencyKey, jobNames, type DeadLetterJob, type QueueProducer } from "@ecommerce/queue";

export const enqueueDeadLetter = async (
  producer: QueueProducer,
  input: {
    readonly tenantId: string;
    readonly originalQueue: string;
    readonly originalJobName: string;
    readonly originalJobId?: string;
    readonly reason: string;
    readonly payload: unknown;
  }
): Promise<void> => {
  const failedAt = new Date().toISOString();
  const idempotencyKey = createIdempotencyKey(input.tenantId, jobNames.deadLetter, [
    input.originalQueue,
    input.originalJobName,
    input.originalJobId ?? failedAt
  ]);

  const job: DeadLetterJob = {
    name: jobNames.deadLetter,
    metadata: {
      tenantId: input.tenantId,
      idempotencyKey,
      createdAt: failedAt
    },
    data: {
      originalQueue: input.originalQueue,
      originalJobName: input.originalJobName,
      ...(input.originalJobId === undefined ? {} : { originalJobId: input.originalJobId }),
      reason: input.reason,
      failedAt,
      payload: input.payload
    }
  };

  await producer.enqueue(job);
};
