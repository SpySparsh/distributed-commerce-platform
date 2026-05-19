import { describe, expect, it } from "vitest";
import { FakeRedisCacheClient } from "../../test-utils/fake-redis.js";
import { testIds } from "../../test-utils/ids.js";
import type { CartRepository, CreateCartInput } from "./cart.repository.js";
import { createCartService } from "./cart.service.js";
import type { CartDto } from "./cart.types.js";

const createCart = (input: Partial<CartDto> = {}): CartDto => ({
  id: testIds.cartId,
  tenantId: testIds.tenantId,
  version: 0,
  items: [],
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  ...input
});

class InMemoryCartRepository implements CartRepository {
  readonly carts = new Map<string, CartDto>();
  expiredCartIds: string[] = [];

  async createCart(input: CreateCartInput): Promise<CartDto> {
    const cart = createCart({
      tenantId: input.tenantId,
      ...(input.userId === undefined ? {} : { userId: input.userId }),
      ...(input.guestId === undefined ? {} : { guestId: input.guestId }),
      ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
      expiresAt: input.expiresAt.toISOString()
    });
    this.carts.set(cart.id, cart);
    return cart;
  }

  async findCart(_tenantId: string, cartId: string): Promise<CartDto | undefined> {
    return this.carts.get(cartId);
  }

  async findActiveUserCart(tenantId: string, userId: string): Promise<CartDto | undefined> {
    return [...this.carts.values()].find((cart) => cart.tenantId === tenantId && cart.userId === userId);
  }

  async findActiveGuestCart(tenantId: string, guestId: string): Promise<CartDto | undefined> {
    return [...this.carts.values()].find((cart) => cart.tenantId === tenantId && cart.guestId === guestId);
  }

  async persistCart(input: { readonly cart: CartDto }): Promise<void> {
    this.carts.set(input.cart.id, input.cart);
  }

  async markCartExpired(_tenantId: string, cartId: string): Promise<void> {
    this.expiredCartIds.push(cartId);
  }
}

describe("cart service", () => {
  it("merges guest carts without duplicating variants", async () => {
    const repository = new InMemoryCartRepository();
    const redis = new FakeRedisCacheClient();
    const target = createCart({
      id: testIds.cartId,
      items: [{
        productId: testIds.productId,
        variantId: testIds.variantId,
        quantity: 1,
        unitPrice: "10.00",
        currency: "USD",
        updatedAt: new Date().toISOString()
      }]
    });
    const source = createCart({
      id: testIds.sourceCartId,
      items: [{
        productId: testIds.productId,
        variantId: testIds.variantId,
        quantity: 3,
        unitPrice: "10.00",
        currency: "USD",
        updatedAt: new Date().toISOString()
      }]
    });
    repository.carts.set(target.id, target);
    repository.carts.set(source.id, source);
    const service = createCartService(repository, {
      getAvailability: async () => ({ variantId: testIds.variantId, availableQuantity: 10 })
    }, redis);

    const merged = await service.mergeGuestCart(testIds.tenantId, source.id, target.id);

    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]?.quantity).toBe(4);
    expect(repository.expiredCartIds).toContain(source.id);
  });
});
