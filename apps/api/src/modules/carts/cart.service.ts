import { randomUUID } from "node:crypto";
import {
  deleteCart,
  getCart,
  acquireInventoryLock,
  mergeCartItems,
  releaseInventoryLock,
  saveCart,
  type CachedCart,
  type RedisCacheClient
} from "@ecommerce/cache";
import type { CartRepository } from "./cart.repository.js";
import type { CartInventoryReader } from "./inventory.reader.js";
import type { CartIdentityQuery, UpsertCartItemBody } from "./cart.schemas.js";
import type { CartDto } from "./cart.types.js";

const cartTtlMs = 1000 * 60 * 60 * 24 * 30;

const toCachedCart = (cart: CartDto): CachedCart => cart;

const toCartDto = (cart: CachedCart): CartDto => cart;

const createExpiration = (): Date => new Date(Date.now() + cartTtlMs);

interface CartOwner {
  readonly userId?: string;
  readonly guestId?: string;
}

const isOwnedBy = (cart: CartDto, owner?: CartOwner): boolean => {
  if (owner === undefined) {
    return true;
  }

  if (owner.userId !== undefined) {
    return cart.userId === owner.userId;
  }

  if (owner.guestId !== undefined) {
    return cart.guestId === owner.guestId;
  }

  return false;
};

export interface CartService {
  getOrCreateCart(identity: CartIdentityQuery): Promise<CartDto>;
  getCart(tenantId: string, cartId: string, owner?: CartOwner): Promise<CartDto | undefined>;
  addItem(tenantId: string, cartId: string, item: UpsertCartItemBody, owner?: CartOwner): Promise<CartDto>;
  setItemQuantity(tenantId: string, cartId: string, item: UpsertCartItemBody, owner?: CartOwner): Promise<CartDto>;
  removeItem(tenantId: string, cartId: string, variantId: string, owner?: CartOwner): Promise<CartDto | undefined>;
  mergeGuestCart(tenantId: string, sourceCartId: string, targetCartId: string): Promise<CartDto>;
  syncCart(tenantId: string, cartId: string, owner?: CartOwner): Promise<CartDto | undefined>;
  expireCart(tenantId: string, cartId: string): Promise<void>;
}

export const createCartService = (
  repository: CartRepository,
  inventory: CartInventoryReader,
  redis: RedisCacheClient
): CartService => ({
  async getOrCreateCart(identity) {
    const existing =
      identity.userId === undefined
        ? identity.guestId === undefined
          ? undefined
          : await repository.findActiveGuestCart(identity.tenantId, identity.guestId)
        : await repository.findActiveUserCart(identity.tenantId, identity.userId);

    if (existing !== undefined) {
      await saveCart(redis, toCachedCart(existing));
      return existing;
    }

    const cart = await repository.createCart({
      tenantId: identity.tenantId,
      ...(identity.userId === undefined ? {} : { userId: identity.userId }),
      ...(identity.guestId === undefined ? {} : { guestId: identity.guestId }),
      ...(identity.deviceId === undefined ? {} : { deviceId: identity.deviceId }),
      expiresAt: createExpiration()
    });
    await saveCart(redis, toCachedCart(cart));
    return cart;
  },

  async getCart(tenantId, cartId, owner) {
    const cached = await getCart(redis, tenantId, cartId);

    if (cached !== undefined) {
      const cart = toCartDto(cached);
      return isOwnedBy(cart, owner) ? cart : undefined;
    }

    const persisted = await repository.findCart(tenantId, cartId, owner);

    if (persisted !== undefined) {
      await saveCart(redis, toCachedCart(persisted));
    }

    return persisted;
  },

  async addItem(tenantId, cartId, item, owner) {
    const lock = await acquireInventoryLock(redis, {
      tenantId,
      variantId: item.variantId
    });

    if (lock === undefined) {
      throw Object.assign(new Error("Inventory is temporarily locked"), {
        code: "INVENTORY_LOCKED",
        statusCode: 409
      });
    }

    try {
      const existing = await this.getCart(tenantId, cartId, owner);

      if (existing === undefined) {
        throw Object.assign(new Error("Cart not found"), {
          code: "CART_NOT_FOUND",
          statusCode: 404
        });
      }

      const existingItem = existing.items.find((cartItem) => cartItem.variantId === item.variantId);
      const nextQuantity = (existingItem?.quantity ?? 0) + item.quantity;
      const availability = await inventory.getAvailability(tenantId, item.variantId);

      if (availability !== undefined && availability.availableQuantity < nextQuantity) {
        throw Object.assign(new Error("Insufficient inventory for cart item"), {
          code: "INSUFFICIENT_INVENTORY",
          statusCode: 409
        });
      }

      const now = new Date().toISOString();
      const nextItems = [
        ...existing.items.filter((existingItem) => existingItem.variantId !== item.variantId),
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: nextQuantity,
          unitPrice: item.unitPrice,
          currency: item.currency,
          updatedAt: now
        }
      ];
      const nextCart: CartDto = {
        ...existing,
        version: existing.version + 1,
        items: nextItems,
        updatedAt: now,
        expiresAt: createExpiration().toISOString()
      };

      await saveCart(redis, toCachedCart(nextCart));
      return nextCart;
    } finally {
      await releaseInventoryLock(redis, lock);
    }
  },

  async setItemQuantity(tenantId, cartId, item, owner) {
    const lock = await acquireInventoryLock(redis, {
      tenantId,
      variantId: item.variantId
    });

    if (lock === undefined) {
      throw Object.assign(new Error("Inventory is temporarily locked"), {
        code: "INVENTORY_LOCKED",
        statusCode: 409
      });
    }

    try {
      const availability = await inventory.getAvailability(tenantId, item.variantId);

      if (availability !== undefined && availability.availableQuantity < item.quantity) {
        throw Object.assign(new Error("Insufficient inventory for cart item"), {
          code: "INSUFFICIENT_INVENTORY",
          statusCode: 409
        });
      }

      const existing = await this.getCart(tenantId, cartId, owner);

      if (existing === undefined) {
        throw Object.assign(new Error("Cart not found"), {
          code: "CART_NOT_FOUND",
          statusCode: 404
        });
      }

      const now = new Date().toISOString();
      const nextItems = [
        ...existing.items.filter((existingItem) => existingItem.variantId !== item.variantId),
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: item.currency,
          updatedAt: now
        }
      ];
      const nextCart: CartDto = {
        ...existing,
        version: existing.version + 1,
        items: nextItems,
        updatedAt: now,
        expiresAt: createExpiration().toISOString()
      };

      await saveCart(redis, toCachedCart(nextCart));
      return nextCart;
    } finally {
      await releaseInventoryLock(redis, lock);
    }
  },

  async removeItem(tenantId, cartId, variantId, owner) {
    const existing = await this.getCart(tenantId, cartId, owner);

    if (existing === undefined) {
      return undefined;
    }

    const now = new Date().toISOString();
    const nextCart: CartDto = {
      ...existing,
      version: existing.version + 1,
      items: existing.items.filter((item) => item.variantId !== variantId),
      updatedAt: now
    };

    await saveCart(redis, toCachedCart(nextCart));
    return nextCart;
  },

  async mergeGuestCart(tenantId, sourceCartId, targetCartId) {
    const source = await this.getCart(tenantId, sourceCartId);
    const target = await this.getCart(tenantId, targetCartId);

    if (source === undefined || target === undefined) {
      throw Object.assign(new Error("Cart not found"), {
        code: "CART_NOT_FOUND",
        statusCode: 404
      });
    }

    const now = new Date().toISOString();
    const merged: CartDto = {
      ...target,
      version: target.version + 1,
      items: mergeCartItems(target.items, source.items),
      updatedAt: now
    };

    await saveCart(redis, toCachedCart(merged));
    await deleteCart(redis, tenantId, sourceCartId);
    await repository.markCartExpired(tenantId, sourceCartId);
    return merged;
  },

  async syncCart(tenantId, cartId, owner) {
    const cart = await this.getCart(tenantId, cartId, owner);

    if (cart === undefined) {
      return undefined;
    }

    await repository.persistCart({ cart });
    return cart;
  },

  async expireCart(tenantId, cartId) {
    await deleteCart(redis, tenantId, cartId);
    await repository.markCartExpired(tenantId, cartId);
  }
});

export const createGuestId = (): string => randomUUID();
