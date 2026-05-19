import { Queue, type ConnectionOptions } from "bullmq";
import { ecommerceJobSchema, type EcommerceJob } from "./schemas.js";
import { createJobOptions, queueRouting } from "./options.js";

export interface QueueProducer {
  enqueue(job: EcommerceJob): Promise<string>;
  close(): Promise<void>;
}

export const createQueueProducer = (connection: ConnectionOptions): QueueProducer => {
  const queues = new Map<string, Queue>();

  const getQueue = (queueName: string): Queue => {
    const existing = queues.get(queueName);

    if (existing !== undefined) {
      return existing;
    }

    const queue = new Queue(queueName, {
      connection
    });
    queues.set(queueName, queue);
    return queue;
  };

  return {
    async enqueue(job) {
      const parsed = ecommerceJobSchema.parse(job);
      const routing = queueRouting[parsed.name];
      const queue = getQueue(routing.queueName);
      const created = await queue.add(
        parsed.name,
        parsed,
        createJobOptions(parsed.name, parsed.metadata.idempotencyKey)
      );

      return created.id ?? parsed.metadata.idempotencyKey;
    },

    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
    }
  };
};
