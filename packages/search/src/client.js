import { categorySearchIndexUid, categorySearchSettings, productSearchIndexUid, productSearchSettings } from "./documents.js";
const toRecord = (value) => typeof value === "object" && value !== null ? value : {};
const parseTask = (value) => {
    const record = toRecord(value);
    return {
        taskUid: typeof record["taskUid"] === "number" ? record["taskUid"] : 0,
        indexUid: typeof record["indexUid"] === "string" ? record["indexUid"] : "",
        status: typeof record["status"] === "string" ? record["status"] : "unknown",
        type: typeof record["type"] === "string" ? record["type"] : "unknown",
        enqueuedAt: typeof record["enqueuedAt"] === "string" ? record["enqueuedAt"] : new Date().toISOString()
    };
};
const parseSearchResponse = (value) => {
    const record = toRecord(value);
    return {
        hits: Array.isArray(record["hits"]) ? record["hits"] : [],
        query: typeof record["query"] === "string" ? record["query"] : "",
        processingTimeMs: typeof record["processingTimeMs"] === "number" ? record["processingTimeMs"] : 0,
        limit: typeof record["limit"] === "number" ? record["limit"] : 0,
        offset: typeof record["offset"] === "number" ? record["offset"] : 0,
        estimatedTotalHits: typeof record["estimatedTotalHits"] === "number" ? record["estimatedTotalHits"] : 0
    };
};
export class MeilisearchHttpClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async setupIndexes() {
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
    searchProducts(request) {
        return this.search(this.indexUid(productSearchIndexUid), request);
    }
    searchCategories(request) {
        return this.search(this.indexUid(categorySearchIndexUid), request);
    }
    async upsertProducts(documents) {
        const response = await this.request(`/indexes/${this.indexUid(productSearchIndexUid)}/documents`, {
            method: "POST",
            body: documents
        });
        return parseTask(response);
    }
    async upsertCategories(documents) {
        const response = await this.request(`/indexes/${this.indexUid(categorySearchIndexUid)}/documents`, {
            method: "POST",
            body: documents
        });
        return parseTask(response);
    }
    async deleteProducts(ids) {
        const response = await this.request(`/indexes/${this.indexUid(productSearchIndexUid)}/documents/delete-batch`, {
            method: "POST",
            body: ids
        });
        return parseTask(response);
    }
    async updateSettings(indexUid, settings) {
        await this.request(`/indexes/${indexUid}/settings`, {
            method: "PATCH",
            body: settings
        });
    }
    indexUid(baseUid) {
        return this.config.indexPrefix === undefined
            ? baseUid
            : `${this.config.indexPrefix}_${baseUid}`;
    }
    async search(indexUid, request) {
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
        return parseSearchResponse(response);
    }
    async request(path, options) {
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
