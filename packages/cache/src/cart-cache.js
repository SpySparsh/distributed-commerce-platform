import { cacheKeys } from "./keys.js";
import { cacheTtl } from "./ttl.js";
export const saveCart = async (redis, cart) => {
    await redis.set(cacheKeys.cart({ tenantId: cart.tenantId, cartId: cart.id }), JSON.stringify(cart), "EX", cacheTtl.cart.freshSeconds);
};
export const touchCartExpiration = async (redis, tenantId, cartId) => {
    await redis.expire(cacheKeys.cart({ tenantId, cartId }), cacheTtl.cart.freshSeconds);
};
export const getCart = async (redis, tenantId, cartId) => {
    const cached = await redis.get(cacheKeys.cart({ tenantId, cartId }));
    return cached === null ? undefined : JSON.parse(cached);
};
export const deleteCart = async (redis, tenantId, cartId) => {
    await redis.del(cacheKeys.cart({ tenantId, cartId }));
};
export const mergeCartItems = (targetItems, sourceItems) => {
    const merged = new Map();
    for (const item of targetItems) {
        merged.set(item.variantId, item);
    }
    for (const item of sourceItems) {
        const existing = merged.get(item.variantId);
        merged.set(item.variantId, {
            ...item,
            quantity: (existing?.quantity ?? 0) + item.quantity,
            updatedAt: new Date().toISOString()
        });
    }
    return [...merged.values()];
};
