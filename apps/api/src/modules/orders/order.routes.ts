import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import type { OrderActor, OrderRepository } from "./order.repository.js";
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

export interface OrderRouteOptions {
  readonly repository: OrderRepository;
}

export const orderRoutes: FastifyPluginAsync<OrderRouteOptions> = async (app, options) => {
  const service = createOrderService(options.repository, app.queues);

  app.post(
    "/",
    {
      preHandler: [
        requirePermission(permissions.ordersWrite),
        withRateLimit({ keyPrefix: "orders:create", maxRequests: 60 }),
        validateRequest({ body: createOrderBodySchema })
      ]
    },
    async (request, reply) => {
      const body = createOrderBodySchema.parse(request.body);
      const order = await service.createOrder({
        ...body,
        tenantId: getAuthenticatedTenantId(request),
        userId: getAuthenticatedUserId(request)
      }, getActor(request));

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
        requirePermission(permissions.ordersRead),
        withRateLimit({ keyPrefix: "orders:get", maxRequests: 120 }),
        validateRequest({
          params: orderParamsSchema,
          query: orderTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = orderParamsSchema.parse(request.params);
      orderTenantQuerySchema.parse(request.query);
      const order = await service.getOrder(getAuthenticatedTenantId(request), params.orderId);

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
        requirePermission(permissions.ordersRead),
        withRateLimit({ keyPrefix: "orders:events", maxRequests: 120 }),
        validateRequest({
          params: orderParamsSchema,
          query: orderTenantQuerySchema
        })
      ]
    },
    async (request) => {
      const params = orderParamsSchema.parse(request.params);
      orderTenantQuerySchema.parse(request.query);
      const events = await service.listEvents(getAuthenticatedTenantId(request), params.orderId);

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
        requirePermission(permissions.ordersWrite),
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
      const order = await service.transitionOrder(params.orderId, {
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      }, getActor(request));

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
        requirePermission(permissions.ordersWrite),
        withRateLimit({ keyPrefix: "orders:invoice", maxRequests: 30 }),
        validateRequest({
          params: orderParamsSchema,
          body: invoiceOrderBodySchema
        })
      ]
    },
    async (request) => {
      const params = orderParamsSchema.parse(request.params);
      invoiceOrderBodySchema.parse(request.body);
      const result = await service.requestInvoice(getAuthenticatedTenantId(request), params.orderId, getActor(request));

      return {
        ok: true,
        data: result
      };
    }
  );
};
