import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { createRedisCacheClient } from "./redis-cache-client.js";
import { UnconfiguredInventoryRepository } from "./inventory.repository.js";
import {
  consumeReservationBodySchema,
  inventoryReservationParamsSchema,
  inventoryTenantQuerySchema,
  inventoryVariantParamsSchema,
  releaseExpiredReservationsBodySchema,
  reservationTenantBodySchema,
  reserveInventoryBodySchema
} from "./inventory.schemas.js";
import { createInventoryService } from "./inventory.service.js";

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  const service = createInventoryService(
    new UnconfiguredInventoryRepository(),
    createRedisCacheClient(app)
  );

  app.get(
    "/variants/:variantId/availability",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "inventory:availability", maxRequests: 300 }),
        validateRequest({
          params: inventoryVariantParamsSchema,
          query: inventoryTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = inventoryVariantParamsSchema.parse(request.params);
      const query = inventoryTenantQuerySchema.parse(request.query);
      const availability = await service.getAvailability(query.tenantId, params.variantId);

      if (availability === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "INVENTORY_ITEM_NOT_FOUND",
            message: "Inventory item not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          availability
        }
      };
    }
  );

  app.post(
    "/reservations",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "inventory:reserve", maxRequests: 120 }),
        validateRequest({ body: reserveInventoryBodySchema })
      ]
    },
    async (request, reply) => {
      const body = reserveInventoryBodySchema.parse(request.body);
      const reservation = await service.reserveStock(body);

      await reply.status(201).send({
        ok: true,
        data: {
          reservation
        }
      });
    }
  );

  app.post(
    "/reservations/:reservationId/release",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "inventory:release", maxRequests: 120 }),
        validateRequest({
          params: inventoryReservationParamsSchema,
          body: reservationTenantBodySchema
        })
      ]
    },
    async (request) => {
      const params = inventoryReservationParamsSchema.parse(request.params);
      const body = reservationTenantBodySchema.parse(request.body);
      const reservation = await service.releaseReservation(body.tenantId, params.reservationId);

      return {
        ok: true,
        data: {
          reservation
        }
      };
    }
  );

  app.post(
    "/reservations/:reservationId/consume",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "inventory:consume", maxRequests: 120 }),
        validateRequest({
          params: inventoryReservationParamsSchema,
          body: consumeReservationBodySchema
        })
      ]
    },
    async (request) => {
      const params = inventoryReservationParamsSchema.parse(request.params);
      const body = consumeReservationBodySchema.parse(request.body);
      const reservation = await service.consumeReservation({
        tenantId: body.tenantId,
        reservationId: params.reservationId,
        ...(body.orderItemId === undefined ? {} : { orderItemId: body.orderItemId })
      });

      return {
        ok: true,
        data: {
          reservation
        }
      };
    }
  );

  app.post(
    "/reservations/release-expired",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "inventory:release-expired", maxRequests: 30 }),
        validateRequest({ body: releaseExpiredReservationsBodySchema })
      ]
    },
    async (request) => {
      const body = releaseExpiredReservationsBodySchema.parse(request.body);
      const result = await service.releaseExpiredReservations({
        now: new Date(),
        batchSize: body.batchSize,
        ...(body.tenantId === undefined ? {} : { tenantId: body.tenantId })
      });

      return {
        ok: true,
        data: result
      };
    }
  );
};
