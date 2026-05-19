import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { createDomainEventPublisher } from "./domain-event-publisher.js";
import type { EventLogRepository } from "./event-log.repository.js";
import { publishDomainEventBodySchema } from "./event.schemas.js";

export interface EventRouteOptions {
  readonly repository: EventLogRepository;
}

export const eventRoutes: FastifyPluginAsync<EventRouteOptions> = async (app, options) => {
  const publisher = createDomainEventPublisher(
    options.repository,
    app.queues
  );

  app.post(
    "/domain-events",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "events:publish", maxRequests: 120 }),
        validateRequest({ body: publishDomainEventBodySchema })
      ]
    },
    async (request, reply) => {
      const event = publishDomainEventBodySchema.parse(request.body);
      const jobId = await publisher.publish(event);

      await reply.status(202).send({
        ok: true,
        data: {
          eventId: event.metadata.eventId,
          jobId
        }
      });
    }
  );
};
