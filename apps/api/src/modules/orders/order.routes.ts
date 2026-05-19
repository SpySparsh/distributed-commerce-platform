import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { UnconfiguredOrderRepository } from "./order.repository.js";
import type { OrderActor } from "./order.repository.js";
import {
  createOrderBodySchema,
  invoiceOrderBodySchema,
  orderParamsSchema,
  orderTenantQuerySchema,
  transitionOrderBodySchema
} from "./order.schemas.js";
import { createOrderService } from "./order.service.js";

const getActor = (request: FastifyRequest): OrderActor => ({
  ...(request.user?.id === undefined ? {} : { userId: request.user.id }),
  requestId: request.id,
  ipAddress: request.ip,
  ...(request.headers["user-agent"] === undefined
    ? {}
    : { userAgent: String(request.headers["user-agent"]) })
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  const service = createOrderService(new UnconfiguredOrderRepository(), app.queues);

  app.post(
    "/",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "orders:create", maxRequests: 60 }),
        validateRequest({ body: createOrderBodySchema })
      ]
    },
    async (request, reply) => {
      const body = createOrderBodySchema.parse(request.body);
      const order = await service.createOrder(body, getActor(request));

      await reply.status(201).send({
        ok: true,
        data: {
          order
        }
      });
    }
  );

  app.get(
    "/:orderId",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "orders:get", maxRequests: 120 }),
        validateRequest({
          params: orderParamsSchema,
          query: orderTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = orderParamsSchema.parse(request.params);
      const query = orderTenantQuerySchema.parse(request.query);
      const order = await service.getOrder(query.tenantId, params.orderId);

      if (order === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          order
        }
      };
    }
  );

  app.get(
    "/:orderId/events",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "orders:events", maxRequests: 120 }),
        validateRequest({
          params: orderParamsSchema,
          query: orderTenantQuerySchema
        })
      ]
    },
    async (request) => {
      const params = orderParamsSchema.parse(request.params);
      const query = orderTenantQuerySchema.parse(request.query);
      const events = await service.listEvents(query.tenantId, params.orderId);

      return {
        ok: true,
        data: {
          events
        }
      };
    }
  );

  app.post(
    "/:orderId/transitions",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "orders:transition", maxRequests: 60 }),
        validateRequest({
          params: orderParamsSchema,
          body: transitionOrderBodySchema
        })
      ]
    },
    async (request) => {
      const params = orderParamsSchema.parse(request.params);
      const body = transitionOrderBodySchema.parse(request.body);
      const order = await service.transitionOrder(params.orderId, body, getActor(request));

      return {
        ok: true,
        data: {
          order
        }
      };
    }
  );

  app.post(
    "/:orderId/invoice",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "orders:invoice", maxRequests: 30 }),
        validateRequest({
          params: orderParamsSchema,
          body: invoiceOrderBodySchema
        })
      ]
    },
    async (request) => {
      const params = orderParamsSchema.parse(request.params);
      const body = invoiceOrderBodySchema.parse(request.body);
      const result = await service.requestInvoice(body.tenantId, params.orderId, getActor(request));

      return {
        ok: true,
        data: result
      };
    }
  );
};
