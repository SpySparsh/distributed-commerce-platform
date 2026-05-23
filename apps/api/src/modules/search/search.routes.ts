import type { FastifyPluginAsync } from "fastify";
import { MeilisearchHttpClient } from "@ecommerce/search";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import {
  adminSearchAnalyticsQuerySchema,
  autocompleteQuerySchema,
  categorySearchQuerySchema,
  databaseSearchQuerySchema,
  indexProductBodySchema,
  productSearchQuerySchema,
  rebuildSearchBodySchema,
  searchClickBodySchema
} from "./search.schemas.js";
import { createSearchService } from "./search.service.js";
import { createDatabaseSearchService } from "./database-search.service.js";

export const searchRoutes: FastifyPluginAsync = async (app) => {
  const searchClient = new MeilisearchHttpClient({
    host: app.config.MEILISEARCH_HOST,
    apiKey: app.config.MEILISEARCH_API_KEY,
    indexPrefix: app.config.MEILISEARCH_INDEX_PREFIX
  });
  const service = createSearchService(searchClient, app.queues);
  const databaseSearch = createDatabaseSearchService(app.prisma);

  app.get(
    "/",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "search:database", maxRequests: 300 }),
        validateRequest({ query: databaseSearchQuerySchema })
      ]
    },
    async (request) => {
      const query = databaseSearchQuerySchema.parse(request.query);
      const userId = request.user?.id;
      const result = await databaseSearch.searchProducts(query, userId);

      return {
        ok: true,
        data: result
      };
    }
  );

  app.post(
    "/click",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "search:click", maxRequests: 600 }),
        validateRequest({ body: searchClickBodySchema })
      ]
    },
    async (request, reply) => {
      const body = searchClickBodySchema.parse(request.body);
      await databaseSearch.recordClick(body, request.user?.id);
      await reply.status(202).send({
        ok: true,
        data: {
          accepted: true
        }
      });
    }
  );

  app.get(
    "/products",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "search:products", maxRequests: 300 }),
        validateRequest({ query: productSearchQuerySchema })
      ]
    },
    async (request) => {
      const query = productSearchQuerySchema.parse(request.query);
      const result = await service.searchProducts(query);

      return {
        ok: true,
        data: result
      };
    }
  );

  app.get(
    "/autocomplete",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "search:autocomplete", maxRequests: 600 }),
        validateRequest({ query: autocompleteQuerySchema })
      ]
    },
    async (request) => {
      const query = autocompleteQuerySchema.parse(request.query);
      const suggestions = await databaseSearch.autocomplete(query.tenantId, query.q, query.limit);

      return {
        ok: true,
        data: {
          suggestions
        }
      };
    }
  );

  app.get(
    "/admin/analytics",
    {
      preHandler: [
        requirePermission(permissions.searchAdmin),
        withRateLimit({ keyPrefix: "search:analytics", maxRequests: 60 }),
        validateRequest({ query: adminSearchAnalyticsQuerySchema })
      ]
    },
    async (request) => {
      const query = adminSearchAnalyticsQuerySchema.parse(request.query);
      const analytics = await databaseSearch.getAnalytics(query);

      return {
        ok: true,
        data: analytics
      };
    }
  );

  app.get(
    "/categories",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "search:categories", maxRequests: 300 }),
        validateRequest({ query: categorySearchQuerySchema })
      ]
    },
    async (request) => {
      const query = categorySearchQuerySchema.parse(request.query);
      const result = await service.searchCategories(query);

      return {
        ok: true,
        data: result
      };
    }
  );

  app.post(
    "/admin/setup-indexes",
    {
      preHandler: [
        requirePermission(permissions.searchAdmin),
        withRateLimit({ keyPrefix: "search:setup", maxRequests: 10 })
      ]
    },
    async () => {
      await service.setupIndexes();

      return {
        ok: true,
        data: {
          status: "accepted"
        }
      };
    }
  );

  app.post(
    "/admin/index-product",
    {
      preHandler: [
        requirePermission(permissions.searchAdmin),
        withRateLimit({ keyPrefix: "search:index-product", maxRequests: 120 }),
        validateRequest({ body: indexProductBodySchema })
      ]
    },
    async (request) => {
      const body = indexProductBodySchema.parse(request.body);
      const jobId = await service.enqueueProductIndex({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

      return {
        ok: true,
        data: {
          jobId
        }
      };
    }
  );

  app.post(
    "/admin/delete-product",
    {
      preHandler: [
        requirePermission(permissions.searchAdmin),
        withRateLimit({ keyPrefix: "search:delete-product", maxRequests: 120 }),
        validateRequest({ body: indexProductBodySchema })
      ]
    },
    async (request) => {
      const body = indexProductBodySchema.parse(request.body);
      const jobId = await service.enqueueProductDelete({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

      return {
        ok: true,
        data: {
          jobId
        }
      };
    }
  );

  app.post(
    "/admin/rebuild",
    {
      preHandler: [
        requirePermission(permissions.searchAdmin),
        withRateLimit({ keyPrefix: "search:rebuild", maxRequests: 10 }),
        validateRequest({ body: rebuildSearchBodySchema })
      ]
    },
    async (request) => {
      const body = rebuildSearchBodySchema.parse(request.body);
      const jobId = await service.enqueueRebuild({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

      return {
        ok: true,
        data: {
          jobId
        }
      };
    }
  );
};
