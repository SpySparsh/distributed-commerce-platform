import {
  buildCategoryFilter,
  buildProductFilter,
  buildProductSort,
  type EcommerceSearchClient,
  type CategorySearchDocument,
  type ProductSearchDocument,
  type SearchResponse
} from "@ecommerce/search";
import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type {
  AutocompleteQuery,
  CategorySearchQuery,
  IndexProductBody,
  ProductSearchQuery,
  RebuildSearchBody
} from "./search.schemas.js";

export interface SearchService {
  setupIndexes(): Promise<void>;
  searchProducts(query: ProductSearchQuery): Promise<SearchResponse<ProductSearchDocument>>;
  autocomplete(query: AutocompleteQuery): Promise<readonly Pick<ProductSearchDocument, "id" | "name" | "slug" | "priceMin" | "currency">[]>;
  searchCategories(query: CategorySearchQuery): Promise<SearchResponse<CategorySearchDocument>>;
  enqueueProductIndex(input: IndexProductBody): Promise<string>;
  enqueueProductDelete(input: IndexProductBody): Promise<string>;
  enqueueRebuild(input: RebuildSearchBody): Promise<string>;
}

export const createSearchService = (
  search: EcommerceSearchClient,
  queues: QueueProducer
): SearchService => ({
  setupIndexes() {
    return search.setupIndexes();
  },

  searchProducts(query) {
    const sort = buildProductSort(query.sort);

    return search.searchProducts({
      q: query.q,
      filter: buildProductFilter({
        tenantId: query.tenantId,
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.categorySlug === undefined ? {} : { categorySlug: query.categorySlug }),
        ...(query.inStock === undefined ? {} : { inStock: query.inStock }),
        ...(query.currency === undefined ? {} : { currency: query.currency }),
        ...(query.minPrice === undefined ? {} : { minPrice: query.minPrice }),
        ...(query.maxPrice === undefined ? {} : { maxPrice: query.maxPrice })
      }),
      ...(sort === undefined ? {} : { sort }),
      limit: query.limit,
      offset: query.offset,
      attributesToHighlight: ["name", "description", "categoryNames"],
      matchingStrategy: "last"
    });
  },

  async autocomplete(query) {
    const response = await search.searchProducts({
      q: query.q,
      filter: buildProductFilter({
        tenantId: query.tenantId,
        inStock: true
      }),
      limit: query.limit,
      offset: 0,
      attributesToHighlight: ["name"],
      matchingStrategy: "last"
    });

    return response.hits.map((hit) => ({
      id: hit.id,
      name: hit.name,
      slug: hit.slug,
      priceMin: hit.priceMin,
      currency: hit.currency
    }));
  },

  searchCategories(query) {
    return search.searchCategories({
      q: query.q,
      filter: buildCategoryFilter(query.tenantId),
      limit: query.limit,
      offset: query.offset,
      sort: ["productCount:desc", "position:asc"],
      matchingStrategy: "last"
    });
  },

  enqueueProductIndex(input) {
    return queues.enqueue({
      name: jobNames.indexProductSearchDocument,
      metadata: {
        tenantId: input.tenantId,
        idempotencyKey: `search-index-product:${input.productId}`,
        createdAt: new Date().toISOString()
      },
      data: {
        productId: input.productId
      }
    });
  },

  enqueueProductDelete(input) {
    return queues.enqueue({
      name: jobNames.deleteProductSearchDocument,
      metadata: {
        tenantId: input.tenantId,
        idempotencyKey: `search-delete-product:${input.productId}`,
        createdAt: new Date().toISOString()
      },
      data: {
        productId: input.productId
      }
    });
  },

  enqueueRebuild(input) {
    return queues.enqueue({
      name: jobNames.rebuildSearchIndex,
      metadata: {
        tenantId: input.tenantId,
        idempotencyKey: `search-rebuild:${input.tenantId}:${input.target}`,
        createdAt: new Date().toISOString()
      },
      data: {
        target: input.target,
        batchSize: input.batchSize
      }
    });
  }
});
