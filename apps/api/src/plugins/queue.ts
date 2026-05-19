import { createQueueProducer, type QueueProducer } from "@ecommerce/queue";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    queues: QueueProducer;
  }
}

export const queuePlugin = fp(
  async (app) => {
    const queues = createQueueProducer({
      url: app.config.REDIS_URL,
      maxRetriesPerRequest: null
    });

    app.decorate("queues", queues);

    app.addHook("onClose", async () => {
      await queues.close();
    });
  },
  {
    name: "queue",
    dependencies: ["config", "redis"]
  }
);
