const namespace = "ecommerce";
const version = "v1";
const encodePart = (value) => encodeURIComponent(value);
export const cacheKeys = {
    productById: ({ tenantId, productId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:product:id:${encodePart(productId)}`,
    productBySlug: ({ tenantId, slug }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:product:slug:${encodePart(slug)}`,
    productList: ({ tenantId, fingerprint }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:products:list:${encodePart(fingerprint)}`,
    categoryById: ({ tenantId, categoryId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:category:id:${encodePart(categoryId)}`,
    categoryTree: ({ tenantId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:categories:tree`,
    hotProducts: ({ tenantId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:products:hot`,
    cart: ({ tenantId, cartId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:${encodePart(cartId)}`,
    userActiveCart: ({ tenantId, userId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:user:${encodePart(userId)}:active`,
    guestActiveCart: ({ tenantId, guestId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:cart:guest:${encodePart(guestId)}:active`,
    inventoryLock: ({ tenantId, variantId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:inventory:lock:${encodePart(variantId)}`,
    patternForTenantProducts: ({ tenantId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:product*`,
    patternForTenantCategories: ({ tenantId }) => `${namespace}:${version}:tenant:${encodePart(tenantId)}:categor*`
};
