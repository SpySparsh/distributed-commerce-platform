import type { ProductListQuery } from "./product.schemas.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import type {
  CategoryNodeDto,
  CursorPage,
  ProductDetailDto,
  ProductImageDto,
  ProductListItemDto,
  ProductVariantDto
} from "./product.types.js";
import type { ProductRepository } from "./product.repository.js";

interface ProductImageRow {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
  readonly position: number;
  readonly isPrimary: boolean;
}

interface InventoryRow {
  readonly quantity: number;
  readonly reserved: number;
  readonly safetyStock: number;
}

interface ProductVariantRow {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly price: { toString(): string };
  readonly compareAtPrice: { toString(): string } | null;
  readonly currency: string;
  readonly attributes: unknown;
  readonly inventoryItem: InventoryRow | null;
}

interface ProductRow {
  readonly id: string;
  readonly tenantId: string;
  readonly categoryId: string | null;
  readonly sku: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly images: readonly ProductImageRow[];
  readonly variants: readonly ProductVariantRow[];
}

interface CategoryRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
}

interface ProductPrismaClient {
  readonly product: {
    findMany(args: unknown): Promise<ProductRow[]>;
    findFirst(args: unknown): Promise<ProductRow | null>;
  };
  readonly category: {
    findMany(args: unknown): Promise<CategoryRow[]>;
  };
}

const productSelect = {
  id: true,
  tenantId: true,
  categoryId: true,
  sku: true,
  slug: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  images: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
    select: {
      id: true,
      url: true,
      altText: true,
      position: true,
      isPrimary: true
    }
  },
  variants: {
    where: { deletedAt: null, status: "active" },
    orderBy: [{ price: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
      compareAtPrice: true,
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
} as const;

const toImageDto = (image: ProductImageRow): ProductImageDto => ({
  id: image.id,
  url: image.url,
  position: image.position,
  isPrimary: image.isPrimary,
  ...(image.altText === null ? {} : { altText: image.altText })
});

const getAvailableQuantity = (inventory: InventoryRow | null): number =>
  Math.max((inventory?.quantity ?? 0) - (inventory?.reserved ?? 0) - (inventory?.safetyStock ?? 0), 0);

const toVariantDto = (variant: ProductVariantRow): ProductVariantDto => ({
  id: variant.id,
  sku: variant.sku,
  name: variant.name,
  price: variant.price.toString(),
  ...(variant.compareAtPrice === null ? {} : { compareAtPrice: variant.compareAtPrice.toString() }),
  currency: variant.currency,
  attributes: typeof variant.attributes === "object" && variant.attributes !== null
    ? (variant.attributes as Record<string, unknown>)
    : {},
  availableQuantity: getAvailableQuantity(variant.inventoryItem)
});

const toListItem = (product: ProductRow): ProductListItemDto => {
  const variants = product.variants.map(toVariantDto);
  const firstVariant = variants[0];
  const primaryImage = product.images[0];

  return {
    id: product.id,
    tenantId: product.tenantId,
    ...(product.categoryId === null ? {} : { categoryId: product.categoryId }),
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    ...(product.description === null ? {} : { description: product.description }),
    status: product.status,
    ...(primaryImage === undefined ? {} : { primaryImage: toImageDto(primaryImage) }),
    ...(firstVariant === undefined ? {} : { minPrice: firstVariant.price, currency: firstVariant.currency }),
    totalAvailable: variants.reduce((total, variant) => total + variant.availableQuantity, 0),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
};

const toDetail = (product: ProductRow): ProductDetailDto => ({
  ...toListItem(product),
  images: product.images.map(toImageDto),
  variants: product.variants.map(toVariantDto)
});

const buildCategoryTree = (rows: readonly CategoryRow[]): readonly CategoryNodeDto[] => {
  const nodes = new Map<string, CategoryNodeDto & { children: CategoryNodeDto[] }>();

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      ...(row.parentId === null ? {} : { parentId: row.parentId }),
      slug: row.slug,
      name: row.name,
      ...(row.description === null ? {} : { description: row.description }),
      position: row.position,
      children: []
    });
  }

  const roots: Array<CategoryNodeDto & { children: CategoryNodeDto[] }> = [];

  for (const node of nodes.values()) {
    if (node.parentId === undefined) {
      roots.push(node);
      continue;
    }

    nodes.get(node.parentId)?.children.push(node);
  }

  return roots;
};

const buildOrderBy = (sort: ProductListQuery["sort"]): unknown[] => {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "name_asc":
      return [{ name: "asc" }, { id: "asc" }];
    case "name_desc":
      return [{ name: "desc" }, { id: "desc" }];
    case "updated_desc":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    case "price_asc":
    case "price_desc":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
};

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: ProductPrismaClient) {}

  async listProducts(query: ProductListQuery): Promise<CursorPage<ProductListItemDto>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.product.findMany({
      where: {
        tenantId: query.tenantId,
        status: "active",
        deletedAt: null,
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.categorySlug === undefined ? {} : { category: { slug: query.categorySlug } }),
        ...(query.q === undefined ? {} : { name: { contains: query.q, mode: "insensitive" } }),
        variants: {
          some: {
            deletedAt: null,
            status: "active",
            ...(query.minPrice === undefined ? {} : { price: { gte: query.minPrice } }),
            ...(query.maxPrice === undefined ? {} : { price: { lte: query.maxPrice } }),
            ...(query.inStock === true
              ? { inventoryItem: { quantity: { gt: 0 } } }
              : {})
          }
        },
        ...(cursor === undefined
          ? {}
          : {
              id: {
                not: cursor.id
              }
            })
      },
      orderBy: buildOrderBy(query.sort),
      take: query.limit + 1,
      select: productSelect
    });

    const pageRows = rows.slice(0, query.limit);
    const nextRow = rows[query.limit];

    return {
      items: pageRows.map(toListItem),
      ...(nextRow === undefined
        ? {}
        : {
            nextCursor: encodeCursor({
              sortValue: nextRow.createdAt.toISOString(),
              id: nextRow.id
            })
          })
    };
  }

  async findProductBySlug(tenantId: string, slug: string): Promise<ProductDetailDto | undefined> {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        slug,
        status: "active",
        deletedAt: null
      },
      select: productSelect
    });

    return product === null ? undefined : toDetail(product);
  }

  async getCategoryTree(tenantId: string): Promise<readonly CategoryNodeDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        parentId: true,
        slug: true,
        name: true,
        description: true,
        position: true
      }
    });

    return buildCategoryTree(categories);
  }
}
