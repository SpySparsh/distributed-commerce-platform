import type { PrismaClient } from "@ecommerce/database";
import type { CartOwnerFilter, CartRepository, CreateCartInput, PersistCartInput } from "./cart.repository.js";
import type { CartDto, CartItemDto } from "./cart.types.js";

interface CartItemRow {
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPrice: { toString(): string };
  readonly currency: string;
  readonly updatedAt: Date;
}

interface CartRow {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string | null;
  readonly guestId: string | null;
  readonly deviceId: string | null;
  readonly status: "active" | "converted" | "abandoned" | "expired";
  readonly version: number;
  readonly updatedAt: Date;
  readonly expiresAt: Date | null;
  readonly items: readonly CartItemRow[];
}

const cartInclude = {
  items: {
    where: {
      deletedAt: null
    }
  }
} as const;

const toItemDto = (item: CartItemRow): CartItemDto => ({
  productId: item.productId,
  variantId: item.variantId,
  quantity: item.quantity,
  unitPrice: item.unitPrice.toString(),
  currency: item.currency,
  updatedAt: item.updatedAt.toISOString()
});

const toCartDto = (cart: CartRow): CartDto => ({
  id: cart.id,
  tenantId: cart.tenantId,
  ...(cart.userId === null ? {} : { userId: cart.userId }),
  ...(cart.guestId === null ? {} : { guestId: cart.guestId }),
  ...(cart.deviceId === null ? {} : { deviceId: cart.deviceId }),
  status: cart.status,
  version: cart.version,
  items: cart.items.map(toItemDto),
  updatedAt: cart.updatedAt.toISOString(),
  expiresAt: (cart.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)).toISOString()
});

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCart(input: CreateCartInput): Promise<CartDto> {
    const cart = await this.prisma.cart.create({
      data: {
        tenantId: input.tenantId,
        status: "active",
        expiresAt: input.expiresAt,
        ...(input.userId === undefined ? {} : { userId: input.userId }),
        ...(input.guestId === undefined ? {} : { guestId: input.guestId }),
        ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId })
      },
      include: cartInclude
    });

    return toCartDto(cart);
  }

  async findCart(tenantId: string, cartId: string, owner?: CartOwnerFilter): Promise<CartDto | undefined> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        tenantId,
        status: "active",
        deletedAt: null,
        ...(owner?.userId === undefined ? {} : { userId: owner.userId }),
        ...(owner?.guestId === undefined ? {} : { guestId: owner.guestId })
      },
      include: cartInclude
    });

    return cart === null ? undefined : toCartDto(cart);
  }

  async findActiveUserCart(tenantId: string, userId: string): Promise<CartDto | undefined> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        userId,
        status: "active",
        deletedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: cartInclude
    });

    return cart === null ? undefined : toCartDto(cart);
  }

  async findActiveGuestCart(tenantId: string, guestId: string): Promise<CartDto | undefined> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        guestId,
        status: "active",
        deletedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: cartInclude
    });

    return cart === null ? undefined : toCartDto(cart);
  }

  async persistCart(input: PersistCartInput): Promise<void> {
    await this.prisma.cart.update({
      where: {
        id: input.cart.id
      },
      data: {
        version: input.cart.version,
        expiresAt: new Date(input.cart.expiresAt),
        lastSyncedAt: new Date()
      }
    });
  }

  async markCartExpired(tenantId: string, cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: {
        id: cartId,
        tenantId
      },
      data: {
        status: "expired",
        expiresAt: new Date()
      }
    });
  }
}
