import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateRequest, withRateLimit } from "../../http/validate.js";

const tenantParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160)
});

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/:slug",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "tenants:resolve", maxRequests: 300 }),
        validateRequest({ params: tenantParamsSchema })
      ]
    },
    async (request, reply) => {
      const params = tenantParamsSchema.parse(request.params);
      const tenant = await app.prisma.tenant.findFirst({
        where: {
          slug: params.slug,
          status: "active",
          deletedAt: null
        },
        select: {
          id: true,
          slug: true,
          name: true
        }
      });

      if (tenant === null) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "TENANT_NOT_FOUND",
            message: "Tenant not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          tenant
        }
      };
    }
  );
};
