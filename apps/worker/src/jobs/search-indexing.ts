import type {
  IndexProductSearchDocumentJob,
  DeleteProductSearchDocumentJob,
  RebuildSearchIndexJob
} from "@ecommerce/queue";
import type { ProductSearchDocument } from "@ecommerce/search";
import type { JobHandlerContext } from "./handlers.js";

type AttributeValue = string | number | boolean | readonly string[];

interface ProductForSearch {
  readonly id: string;
  readonly tenantId: string;
  readonly sku: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly updatedAt: Date;
  readonly category: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  } | null;
  readonly variants: readonly {
    readonly id: string;
    readonly sku: string;
    readonly price: { toString(): string };
    readonly currency: string;
    readonly attributes: unknown;
    readonly inventoryItem: {
      readonly quantity: number;
      readonly reserved: number;
      readonly safetyStock: number;
    } | null;
  }[];
}

const toSearchAttributeValue = (value: unknown): AttributeValue | undefined => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }

  return undefined;
};

const toAttributes = (variants: ProductForSearch["variants"]): Record<string, AttributeValue> => {
  const attributes: Record<string, AttributeValue> = {};

  for (const variant of variants) {
    if (typeof variant.attributes !== "object" || variant.attributes === null || Array.isArray(variant.attributes)) {
      continue;
    }

    for (const [key, value] of Object.entries(variant.attributes)) {
      const parsed = toSearchAttributeValue(value);

      if (parsed !== undefined) {
        attributes[key] = parsed;
      }
    }
  }

  return attributes;
};

const availableQuantity = (variant: ProductForSearch["variants"][number]): number => {
  const inventory = variant.inventoryItem;

  if (inventory === null) {
    return 0;
  }

  return Math.max(inventory.quantity - inventory.reserved - inventory.safetyStock, 0);
};

const toProductDocument = (product: ProductForSearch): ProductSearchDocument => {
  const prices = product.variants.map((variant) => Number(variant.price.toString()));
  const totalAvailable = product.variants.reduce((total, variant) => total + availableQuantity(variant), 0);
  const categoryIds = product.category === null ? [] : [product.category.id];
  const categorySlugs = product.category === null ? [] : [product.category.slug];
  const categoryNames = product.category === null ? [] : [product.category.name];

  return {
    id: `${product.tenantId}:${product.id}`,
    tenantId: product.tenantId,
    productId: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    ...(product.description === null ? {} : { description: product.description }),
    categoryIds,
    categorySlugs,
    categoryNames,
    variantIds: product.variants.map((variant) => variant.id),
    variantSkus: product.variants.map((variant) => variant.sku),
    attributes: toAttributes(product.variants),
    priceMin: prices.length === 0 ? 0 : Math.min(...prices),
    priceMax: prices.length === 0 ? 0 : Math.max(...prices),
    currency: product.variants[0]?.currency ?? "USD",
    availableQuantity: totalAvailable,
    inStock: totalAvailable > 0,
    status: "active",
    popularityScore: totalAvailable,
    updatedAt: product.updatedAt.getTime()
  };
};

const getProductForSearch = async (
  context: JobHandlerContext,
  tenantId: string,
  productId: string
): Promise<ProductSearchDocument | undefined> => {
  const product = await context.prisma.product.findFirst({
    where: {
      id: productId,
      tenantId,
      status: "active",
      deletedAt: null
    },
    include: {
      category: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      },
      variants: {
        where: {
          status: "active",
          deletedAt: null
        },
        select: {
          id: true,
          sku: true,
          price: true,
          currency: true,
          attributes: true,
          inventoryItem: {
            select: {
              quantity: true,
              reserved: true,
              safetyStock: true
            }
          }
        }
      }
    }
  });

  return product === null ? undefined : toProductDocument(product);
};

export const handleProductIndexJob = async (
  job: IndexProductSearchDocumentJob,
  context: JobHandlerContext
): Promise<void> => {
  const document = await getProductForSearch(context, job.metadata.tenantId, job.data.productId);

  if (document === undefined) {
    await context.search.deleteProducts([`${job.metadata.tenantId}:${job.data.productId}`]);
    context.logger.info(
      { tenantId: job.metadata.tenantId, productId: job.data.productId },
      "Deleted missing product from search index"
    );
    return;
  }

  const task = await context.search.upsertProducts([document]);
  context.logger.info(
    {
      tenantId: job.metadata.tenantId,
      productId: job.data.productId,
      taskUid: task.taskUid,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Product search document indexed"
  );
};

export const handleProductDeleteJob = async (
  job: DeleteProductSearchDocumentJob,
  context: JobHandlerContext
): Promise<void> => {
  const task = await context.search.deleteProducts([`${job.metadata.tenantId}:${job.data.productId}`]);

  context.logger.info(
    {
      tenantId: job.metadata.tenantId,
      productId: job.data.productId,
      taskUid: task.taskUid,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Product search document deleted"
  );
};

export const handleSearchRebuildJob = async (
  job: RebuildSearchIndexJob,
  context: JobHandlerContext
): Promise<void> => {
  await context.search.setupIndexes();

  if (job.data.target === "categories") {
    context.logger.info(
      { tenantId: job.metadata.tenantId, target: job.data.target },
      "Category search rebuild is not implemented yet"
    );
    return;
  }

  let cursor: string | undefined;
  let indexed = 0;

  do {
    const products = await context.prisma.product.findMany({
      where: {
        tenantId: job.metadata.tenantId,
        status: "active",
        deletedAt: null
      },
      orderBy: [{ id: "asc" }],
      take: job.data.batchSize,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true
      }
    });

    for (const product of products) {
      const document = await getProductForSearch(context, job.metadata.tenantId, product.id);

      if (document !== undefined) {
        await context.search.upsertProducts([document]);
        indexed += 1;
      }
    }

    cursor = products.at(-1)?.id;

    if (products.length < job.data.batchSize) {
      cursor = undefined;
    }
  } while (cursor !== undefined);

  context.logger.info(
    {
      tenantId: job.metadata.tenantId,
      target: job.data.target,
      indexed,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Search index rebuild completed"
  );
};
