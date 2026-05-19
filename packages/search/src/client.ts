import {
  categorySearchIndexUid,
  categorySearchSettings,
  productSearchIndexUid,
  productSearchSettings,
  type CategorySearchDocument,
  type ProductSearchDocument,
  type SearchSettings
} from "./documents.js";

export interface MeilisearchConfig {
  readonly host: string;
  readonly apiKey: string;
  readonly indexPrefix?: string;
}

export interface SearchRequest {
  readonly q: string;
  readonly filter?: readonly string[];
  readonly sort?: readonly string[];
  readonly limit: number;
  readonly offset: number;
  readonly attributesToHighlight?: readonly string[];
  readonly matchingStrategy?: "last" | "all" | "frequency";
}

export interface SearchResponse<TDocument> {
  readonly hits: readonly TDocument[];
  readonly query: string;
  readonly processingTimeMs: number;
  readonly limit: number;
  readonly offset: number;
  readonly estimatedTotalHits: number;
}

export interface IndexTask {
  readonly taskUid: number;
  readonly indexUid: string;
  readonly status: string;
  readonly type: string;
  readonly enqueuedAt: string;
}

export interface EcommerceSearchClient {
  setupIndexes(): Promise<void>;
  searchProducts(request: SearchRequest): Promise<SearchResponse<ProductSearchDocument>>;
  searchCategories(request: SearchRequest): Promise<SearchResponse<CategorySearchDocument>>;
  upsertProducts(documents: readonly ProductSearchDocument[]): Promise<IndexTask>;
  upsertCategories(documents: readonly CategorySearchDocument[]): Promise<IndexTask>;
  deleteProducts(ids: readonly string[]): Promise<IndexTask>;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const parseTask = (value: unknown): IndexTask => {
  const record = toRecord(value);

  return {
    taskUid: typeof record["taskUid"] === "number" ? record["taskUid"] : 0,
    indexUid: typeof record["indexUid"] === "string" ? record["indexUid"] : "",
    status: typeof record["status"] === "string" ? record["status"] : "unknown",
    type: typeof record["type"] === "string" ? record["type"] : "unknown",
    enqueuedAt: typeof record["enqueuedAt"] === "string" ? record["enqueuedAt"] : new Date().toISOString()
  };
};

const parseSearchResponse = <TDocument>(value: unknown): SearchResponse<TDocument> => {
  const record = toRecord(value);

  return {
    hits: Array.isArray(record["hits"]) ? record["hits"] as TDocument[] : [],
    query: typeof record["query"] === "string" ? record["query"] : "",
    processingTimeMs: typeof record["processingTimeMs"] === "number" ? record["processingTimeMs"] : 0,
    limit: typeof record["limit"] === "number" ? record["limit"] : 0,
    offset: typeof record["offset"] === "number" ? record["offset"] : 0,
    estimatedTotalHits:
      typeof record["estimatedTotalHits"] === "number" ? record["estimatedTotalHits"] : 0
  };
};

export class MeilisearchHttpClient implements EcommerceSearchClient {
  constructor(private readonly config: MeilisearchConfig) {}

  async setupIndexes(): Promise<void> {
    await this.request("/indexes", {
      method: "POST",
      body: {
        uid: this.indexUid(productSearchIndexUid),
        primaryKey: "id"
      }
    });
    await this.request("/indexes", {
      method: "POST",
      body: {
        uid: this.indexUid(categorySearchIndexUid),
        primaryKey: "id"
      }
    });
    await this.updateSettings(this.indexUid(productSearchIndexUid), productSearchSettings);
    await this.updateSettings(this.indexUid(categorySearchIndexUid), categorySearchSettings);
  }

  searchProducts(request: SearchRequest): Promise<SearchResponse<ProductSearchDocument>> {
    return this.search<ProductSearchDocument>(this.indexUid(productSearchIndexUid), request);
  }

  searchCategories(request: SearchRequest): Promise<SearchResponse<CategorySearchDocument>> {
    return this.search<CategorySearchDocument>(this.indexUid(categorySearchIndexUid), request);
  }

  async upsertProducts(documents: readonly ProductSearchDocument[]): Promise<IndexTask> {
    const response = await this.request(`/indexes/${this.indexUid(productSearchIndexUid)}/documents`, {
      method: "POST",
      body: documents
    });
    return parseTask(response);
  }

  async upsertCategories(documents: readonly CategorySearchDocument[]): Promise<IndexTask> {
    const response = await this.request(`/indexes/${this.indexUid(categorySearchIndexUid)}/documents`, {
      method: "POST",
      body: documents
    });
    return parseTask(response);
  }

  async deleteProducts(ids: readonly string[]): Promise<IndexTask> {
    const response = await this.request(`/indexes/${this.indexUid(productSearchIndexUid)}/documents/delete-batch`, {
      method: "POST",
      body: ids
    });
    return parseTask(response);
  }

  private async updateSettings(indexUid: string, settings: SearchSettings): Promise<void> {
    await this.request(`/indexes/${indexUid}/settings`, {
      method: "PATCH",
      body: settings
    });
  }

  private indexUid(baseUid: string): string {
    return this.config.indexPrefix === undefined
      ? baseUid
      : `${this.config.indexPrefix}_${baseUid}`;
  }

  private async search<TDocument>(
    indexUid: string,
    request: SearchRequest
  ): Promise<SearchResponse<TDocument>> {
    const response = await this.request(`/indexes/${indexUid}/search`, {
      method: "POST",
      body: {
        q: request.q,
        limit: request.limit,
        offset: request.offset,
        ...(request.filter === undefined ? {} : { filter: request.filter }),
        ...(request.sort === undefined ? {} : { sort: request.sort }),
        ...(request.attributesToHighlight === undefined
          ? {}
          : { attributesToHighlight: request.attributesToHighlight }),
        ...(request.matchingStrategy === undefined ? {} : { matchingStrategy: request.matchingStrategy })
      }
    });

    return parseSearchResponse<TDocument>(response);
  }

  private async request(path: string, options: {
    readonly method: "GET" | "POST" | "PATCH";
    readonly body?: unknown;
  }): Promise<unknown> {
    const response = await fetch(`${this.config.host}${path}`, {
      method: options.method,
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json"
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Meilisearch request failed: ${response.status} ${text}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }
}
