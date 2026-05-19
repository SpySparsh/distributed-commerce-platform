export interface CacheKeyParts {
  readonly tenantId: string;
}

const namespace = "ecommerce";
const version = "v1";

const encodePart = (value: string): string => encodeURIComponent(value);

export const cacheKeys = {
  productById: ({ tenantId, productId }: CacheKeyParts & { readonly productId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:product:id:${encodePart(productId)}`,

  productBySlug: ({ tenantId, slug }: CacheKeyParts & { readonly slug: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:product:slug:${encodePart(slug)}`,

  productList: ({ tenantId, fingerprint }: CacheKeyParts & { readonly fingerprint: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:products:list:${encodePart(fingerprint)}`,

  categoryById: ({ tenantId, categoryId }: CacheKeyParts & { readonly categoryId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:category:id:${encodePart(categoryId)}`,

  categoryTree: ({ tenantId }: CacheKeyParts): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:categories:tree`,

  hotProducts: ({ tenantId }: CacheKeyParts): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:products:hot`,

  cart: ({ tenantId, cartId }: CacheKeyParts & { readonly cartId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:${encodePart(cartId)}`,

  userActiveCart: ({ tenantId, userId }: CacheKeyParts & { readonly userId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:user:${encodePart(userId)}:active`,

  guestActiveCart: ({ tenantId, guestId }: CacheKeyParts & { readonly guestId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:guest:${encodePart(guestId)}:active`,

  inventoryLock: ({
    tenantId,
    variantId
  }: CacheKeyParts & { readonly variantId: string }): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:inventory:lock:${encodePart(variantId)}`,

  patternForTenantProducts: ({ tenantId }: CacheKeyParts): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:product*`,

  patternForTenantCategories: ({ tenantId }: CacheKeyParts): string =>
    `${namespace}:${version}:tenant:${encodePart(tenantId)}:categor*`
} as const;
