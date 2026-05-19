import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import { createRedisCacheClient } from "./redis-cache-client.js";
import type { InventoryRepository } from "./inventory.repository.js";
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

export interface InventoryRouteOptions {
  readonly repository: InventoryRepository;
}

export const inventoryRoutes: FastifyPluginAsync<InventoryRouteOptions> = async (app, options) => {
  const service = createInventoryService(
    options.repository,
    createRedisCacheClient(app)
  );

  app.get(
    "/variants/:variantId/availability",
    {
      preHandler: [
        requirePermission(permissions.inventoryRead),
        withRateLimit({ keyPrefix: "inventory:availability", maxRequests: 300 }),
        validateRequest({
          params: inventoryVariantParamsSchema,
          query: inventoryTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = inventoryVariantParamsSchema.parse(request.params);
      inventoryTenantQuerySchema.parse(request.query);
      const availability = await service.getAvailability(getAuthenticatedTenantId(request), params.variantId);

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
        requirePermission(permissions.inventoryWrite),
        withRateLimit({ keyPrefix: "inventory:reserve", maxRequests: 120 }),
        validateRequest({ body: reserveInventoryBodySchema })
      ]
    },
    async (request, reply) => {
      const body = reserveInventoryBodySchema.parse(request.body);
      const reservation = await service.reserveStock({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

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
        requirePermission(permissions.inventoryWrite),
        withRateLimit({ keyPrefix: "inventory:release", maxRequests: 120 }),
        validateRequest({
          params: inventoryReservationParamsSchema,
          body: reservationTenantBodySchema
        })
      ]
    },
    async (request) => {
      const params = inventoryReservationParamsSchema.parse(request.params);
      reservationTenantBodySchema.parse(request.body);
      const reservation = await service.releaseReservation(getAuthenticatedTenantId(request), params.reservationId);

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
        requirePermission(permissions.inventoryWrite),
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
        tenantId: getAuthenticatedTenantId(request),
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
        requirePermission(permissions.inventoryWrite),
        withRateLimit({ keyPrefix: "inventory:release-expired", maxRequests: 30 }),
        validateRequest({ body: releaseExpiredReservationsBodySchema })
      ]
    },
    async (request) => {
      const body = releaseExpiredReservationsBodySchema.parse(request.body);
      const result = await service.releaseExpiredReservations({
        now: new Date(),
        batchSize: body.batchSize,
        tenantId: getAuthenticatedTenantId(request)
      });

      return {
        ok: true,
        data: result
      };
    }
  );
};
