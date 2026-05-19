import type { CartDto } from "./cart.types.js";

export interface CreateCartInput {
  readonly tenantId: string;
  readonly userId?: string;
  readonly guestId?: string;
  readonly deviceId?: string;
  readonly expiresAt: Date;
}

export interface PersistCartInput {
  readonly cart: CartDto;
}

export interface CartRepository {
  createCart(input: CreateCartInput): Promise<CartDto>;
  findCart(tenantId: string, cartId: string): Promise<CartDto | undefined>;
  findActiveUserCart(tenantId: string, userId: string): Promise<CartDto | undefined>;
  findActiveGuestCart(tenantId: string, guestId: string): Promise<CartDto | undefined>;
  persistCart(input: PersistCartInput): Promise<void>;
  markCartExpired(tenantId: string, cartId: string): Promise<void>;
}

export class UnconfiguredCartRepository implements CartRepository {
  async createCart(): Promise<CartDto> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }

  async findCart(): Promise<CartDto | undefined> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }

  async findActiveUserCart(): Promise<CartDto | undefined> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }

  async findActiveGuestCart(): Promise<CartDto | undefined> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }

  async persistCart(): Promise<void> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }

  async markCartExpired(): Promise<void> {
    throw new Error("CartRepository is not configured with Prisma yet.");
  }
}
