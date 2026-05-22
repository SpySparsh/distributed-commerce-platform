import { cacheKeys } from "./keys.js";
import type { RedisCacheClient } from "./redis.js";
import { cacheTtl } from "./ttl.js";

export interface CachedCartItem {
  readonly productId: string;
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
  readonly guestId?: string;
  readonly deviceId?: string;
  readonly status?: "active" | "converted" | "abandoned" | "expired";
  readonly version: number;
  readonly items: readonly CachedCartItem[];
  readonly updatedAt: string;
  readonly expiresAt: string;
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

export const touchCartExpiration = async (
  redis: RedisCacheClient,
  tenantId: string,
  cartId: string
): Promise<void> => {
  await redis.expire(cacheKeys.cart({ tenantId, cartId }), cacheTtl.cart.freshSeconds);
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

export const mergeCartItems = (
  targetItems: readonly CachedCartItem[],
  sourceItems: readonly CachedCartItem[]
): readonly CachedCartItem[] => {
  const merged = new Map<string, CachedCartItem>();

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
