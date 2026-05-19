import { cacheKeys } from "./keys.js";
import type { RedisCacheClient } from "./redis.js";
import { cacheTtl } from "./ttl.js";

export interface CachedCartItem {
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly currency: string;
  readonly updatedAt: string;
}

export interface CachedCart {
  readonly id: string;
  readonly tenantId: string;
  readonly userId?: string;
  readonly items: readonly CachedCartItem[];
  readonly updatedAt: string;
}

export const saveCart = async (
  redis: RedisCacheClient,
  cart: CachedCart
): Promise<void> => {
  await redis.set(
    cacheKeys.cart({ tenantId: cart.tenantId, cartId: cart.id }),
    JSON.stringify(cart),
    "EX",
    cacheTtl.cart.freshSeconds
  );
};

export const getCart = async (
  redis: RedisCacheClient,
  tenantId: string,
  cartId: string
): Promise<CachedCart | undefined> => {
  const cached = await redis.get(cacheKeys.cart({ tenantId, cartId }));
  return cached === null ? undefined : (JSON.parse(cached) as CachedCart);
};

export const deleteCart = async (
  redis: RedisCacheClient,
  tenantId: string,
  cartId: string
): Promise<void> => {
  await redis.del(cacheKeys.cart({ tenantId, cartId }));
};
