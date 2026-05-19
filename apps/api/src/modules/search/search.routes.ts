import type { FastifyPluginAsync } from "fastify";
import { MeilisearchHttpClient } from "@ecommerce/search";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import {
  autocompleteQuerySchema,
  categorySearchQuerySchema,
  indexProductBodySchema,
  productSearchQuerySchema,
  rebuildSearchBodySchema
} from "./search.schemas.js";
import { createSearchService } from "./search.service.js";

export const searchRoutes: FastifyPluginAsync = async (app) => {
  const searchClient = new MeilisearchHttpClient({
    host: app.config.MEILISEARCH_HOST,
    apiKey: app.config.MEILISEARCH_API_KEY,
    indexPrefix: app.config.MEILISEARCH_INDEX_PREFIX
  });
  const service = createSearchService(searchClient, app.queues);

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
      const suggestions = await service.autocomplete(query);

      return {
        ok: true,
        data: {
          suggestions
        }
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
      preHandler: [withRateLimit({ keyPrefix: "search:setup", maxRequests: 10 })]
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
        withRateLimit({ keyPrefix: "search:index-product", maxRequests: 120 }),
        validateRequest({ body: indexProductBodySchema })
      ]
    },
    async (request) => {
      const body = indexProductBodySchema.parse(request.body);
      const jobId = await service.enqueueProductIndex(body);

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
        withRateLimit({ keyPrefix: "search:delete-product", maxRequests: 120 }),
        validateRequest({ body: indexProductBodySchema })
      ]
    },
    async (request) => {
      const body = indexProductBodySchema.parse(request.body);
      const jobId = await service.enqueueProductDelete(body);

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
        withRateLimit({ keyPrefix: "search:rebuild", maxRequests: 10 }),
        validateRequest({ body: rebuildSearchBodySchema })
      ]
    },
    async (request) => {
      const body = rebuildSearchBodySchema.parse(request.body);
      const jobId = await service.enqueueRebuild(body);

      return {
        ok: true,
        data: {
          jobId
        }
      };
    }
  );
};
