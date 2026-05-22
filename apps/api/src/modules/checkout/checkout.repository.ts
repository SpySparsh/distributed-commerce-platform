import { Prisma, type PrismaClient } from "@ecommerce/database";
import { randomUUID } from "node:crypto";
import type { ApiEnv } from "../../env.js";
import type { CartDto, CartItemDto } from "../carts/cart.types.js";
import type { OrderActor } from "../orders/order.repository.js";
import type { OrderDto, OrderStatus } from "../orders/order.types.js";
import { createPaymentProviderClient } from "../payments/payment.provider.js";
import type { PaymentDto, PaymentInitiationDto, PaymentProvider, PaymentStatus } from "../payments/payment.types.js";
import {
  checkoutCartAlreadyCheckedOutError,
  checkoutCartEmptyError,
  checkoutCartMismatchError,
  checkoutCartNotFoundError,
  checkoutInventoryUnavailableError,
  checkoutPaymentConflictError
} from "./checkout.errors.js";
import type { StartCheckoutBody } from "./checkout.schemas.js";
import type { CheckoutResultDto } from "./checkout.types.js";

interface ProductVariantSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly price: Prisma.Decimal;
  readonly currency: string;
}

interface CartItemSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly reservations: readonly ReservationSnapshot[];
}

interface ReservationSnapshot {
  readonly id: string;
  readonly inventoryItemId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly expiresAt: Date;
}

interface OrderRow {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string | null;
  readonly cartId: string | null;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly subtotalAmount: { toString(): string };
  readonly taxAmount: { toString(): string };
  readonly shippingAmount: { toString(): string };
  readonly discountAmount: { toString(): string };
  readonly totalAmount: { toString(): string };
  readonly currency: string;
  readonly email: string;
  readonly shippingAddress: unknown;
  readonly billingAddress: unknown;
  readonly invoiceNumber: string | null;
  readonly invoiceUrl: string | null;
  readonly placedAt: Date | null;
  readonly invoicedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly {
    readonly id: string;
    readonly productId: string;
    readonly variantId: string;
    readonly sku: string;
    readonly name: string;
    readonly quantity: number;
    readonly unitPrice: { toString(): string };
    readonly totalAmount: { toString(): string };
    readonly currency: string;
  }[];
}

interface PaymentRow {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly provider: string;
  readonly status: PaymentStatus;
  readonly amount: { toString(): string };
  readonly currency: string;
  readonly providerPaymentId: string | null;
  readonly providerTransactionId: string | null;
  readonly idempotencyKey: string;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly retryCount: number;
  readonly nextRetryAt: Date | null;
  readonly metadata: unknown;
  readonly authorizedAt: Date | null;
  readonly capturedAt: Date | null;
  readonly failedAt: Date | null;
  readonly refundedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const orderInclude = {
  items: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.OrderInclude;

const reservationTtlMs = 15 * 60 * 1000;

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const toJsonObject = (value: Record<string, unknown>): Prisma.InputJsonObject =>
  value as Prisma.InputJsonObject;

const toMinorUnits = (amount: string): number => Math.round(Number(amount) * 100);

const toMoney = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

const multiplyMoney = (amount: string, quantity: number): string =>
  toMoney(toMinorUnits(amount) * quantity);

const sumMoney = (items: readonly string[]): string =>
  toMoney(items.reduce((total, amount) => total + toMinorUnits(amount), 0));

const createOrderNumber = (): string =>
  `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

const cartItemKey = (productId: string, variantId: string): string => `${productId}:${variantId}`;

const sumReservationQuantity = (reservations: readonly { readonly quantity: number }[]): number =>
  reservations.reduce((total, reservation) => total + reservation.quantity, 0);

const isImmediateSettlementProvider = (provider: PaymentProvider): boolean =>
  provider === "cod" || provider === "manual";

const toOrderDto = (row: OrderRow): OrderDto => ({
  id: row.id,
  tenantId: row.tenantId,
  ...(row.userId === null ? {} : { userId: row.userId }),
  ...(row.cartId === null ? {} : { cartId: row.cartId }),
  orderNumber: row.orderNumber,
  status: row.status,
  subtotalAmount: row.subtotalAmount.toString(),
  taxAmount: row.taxAmount.toString(),
  shippingAmount: row.shippingAmount.toString(),
  discountAmount: row.discountAmount.toString(),
  totalAmount: row.totalAmount.toString(),
  currency: row.currency,
  email: row.email,
  shippingAddress: toRecord(row.shippingAddress),
  ...(row.billingAddress === null ? {} : { billingAddress: toRecord(row.billingAddress) }),
  ...(row.invoiceNumber === null ? {} : { invoiceNumber: row.invoiceNumber }),
  ...(row.invoiceUrl === null ? {} : { invoiceUrl: row.invoiceUrl }),
  ...(row.placedAt === null ? {} : { placedAt: row.placedAt.toISOString() }),
  ...(row.invoicedAt === null ? {} : { invoicedAt: row.invoicedAt.toISOString() }),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  items: row.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toString(),
    totalAmount: item.totalAmount.toString(),
    currency: item.currency
  }))
});

const toPaymentProvider = (provider: string): PaymentProvider => {
  if (provider === "stripe" || provider === "razorpay" || provider === "cod" || provider === "manual") {
    return provider;
  }

  throw checkoutPaymentConflictError();
};

const toPaymentDto = (row: PaymentRow): PaymentDto => ({
  id: row.id,
  tenantId: row.tenantId,
  orderId: row.orderId,
  provider: toPaymentProvider(row.provider),
  status: row.status,
  amount: row.amount.toString(),
  currency: row.currency,
  ...(row.providerPaymentId === null ? {} : { providerPaymentId: row.providerPaymentId }),
  ...(row.providerTransactionId === null ? {} : { providerTransactionId: row.providerTransactionId }),
  idempotencyKey: row.idempotencyKey,
  ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
  ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
  retryCount: row.retryCount,
  ...(row.nextRetryAt === null ? {} : { nextRetryAt: row.nextRetryAt.toISOString() }),
  metadata: toRecord(row.metadata),
  ...(row.authorizedAt === null ? {} : { authorizedAt: row.authorizedAt.toISOString() }),
  ...(row.capturedAt === null ? {} : { capturedAt: row.capturedAt.toISOString() }),
  ...(row.failedAt === null ? {} : { failedAt: row.failedAt.toISOString() }),
  ...(row.refundedAt === null ? {} : { refundedAt: row.refundedAt.toISOString() }),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export interface CheckoutRepository {
  startCheckout(input: StartCheckoutBody, cart: CartDto | undefined, actor: OrderActor): Promise<CheckoutResultDto>;
}

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: ApiEnv
  ) {}

  async startCheckout(input: StartCheckoutBody, cart: CartDto | undefined, actor: OrderActor): Promise<CheckoutResultDto> {
    const existing = await this.findExistingCheckout(input.tenantId, input.idempotencyKey);

    if (existing !== undefined) {
      return this.createProviderIntentSafely(existing, input.provider ?? existing.payment.provider);
    }

    if (cart === undefined) {
      throw checkoutCartNotFoundError();
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const persistedCart = await this.persistCartSnapshot(tx, input, cart);
        const variants = await this.getVariantSnapshots(tx, input.tenantId, cart.items);
        const cartItems = await this.persistCartItems(tx, input, cart, variants);
        const reservations = await this.reserveCartItems(tx, input, cartItems);
        const order = await this.createOrder(tx, input, actor, cart, variants);
        await this.linkReservationsToOrderItems(tx, input.tenantId, order, cartItems, reservations);
        const payment = await this.createLocalPayment(tx, input, order);
        const paymentDto = toPaymentDto(payment);
        const cartStatus = isImmediateSettlementProvider(paymentDto.provider) ? "converted" as const : "active" as const;

        if (isImmediateSettlementProvider(paymentDto.provider)) {
          await tx.cart.update({
            where: { id: input.cartId },
            data: {
              status: "converted",
              lastSyncedAt: new Date()
            }
          });
        }

        return {
          cart: {
            ...persistedCart,
            status: cartStatus
          },
          order: toOrderDto(order),
          payment: paymentDto
        };
      },
      {
        maxWait: 5_000,
        timeout: 20_000
      }
    );

    return this.createProviderIntentSafely(result, input.provider ?? result.payment.provider);
  }

  private async findExistingCheckout(
    tenantId: string,
    idempotencyKey: string
  ): Promise<{ readonly cart: CartDto; readonly order: OrderDto; readonly payment: PaymentDto } | undefined> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        idempotencyKey,
        deletedAt: null
      }
    });

    if (payment === null) {
      return undefined;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: payment.orderId,
        tenantId,
        deletedAt: null
      },
      include: orderInclude
    });

    if (order === null || order.cartId === null) {
      throw checkoutPaymentConflictError();
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        id: order.cartId,
        tenantId,
        deletedAt: null
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (cart === null) {
      throw checkoutPaymentConflictError();
    }

    return {
      cart: {
        id: cart.id,
        tenantId: cart.tenantId,
        ...(cart.userId === null ? {} : { userId: cart.userId }),
        ...(cart.guestId === null ? {} : { guestId: cart.guestId }),
        ...(cart.deviceId === null ? {} : { deviceId: cart.deviceId }),
        status: cart.status,
        version: cart.version,
        items: cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          currency: item.currency,
          updatedAt: item.updatedAt.toISOString()
        })),
        updatedAt: cart.updatedAt.toISOString(),
        expiresAt: (cart.expiresAt ?? new Date()).toISOString()
      },
      order: toOrderDto(order),
      payment: toPaymentDto(payment)
    };
  }

  private async createProviderIntent(
    result: { readonly cart: CartDto; readonly order: OrderDto; readonly payment: PaymentDto },
    provider: PaymentProvider
  ): Promise<CheckoutResultDto> {
    if (result.payment.provider !== provider) {
      throw checkoutPaymentConflictError();
    }

    if (provider === "cod" || provider === "manual") {
      return {
        cart: result.cart,
        order: result.order,
        payment: {
          payment: result.payment
        }
      };
    }

    const providerClient = createPaymentProviderClient(provider, this.env);
    const providerResult = await providerClient.createPayment({
      tenantId: result.payment.tenantId,
      orderId: result.payment.orderId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      idempotencyKey: result.payment.idempotencyKey,
      paymentId: result.payment.id
    });

    const updatedPayment =
      providerResult.providerOrderId === undefined
        ? result.payment
        : await this.updateProviderPayment(result.payment, providerResult.providerOrderId);

    const payment: PaymentInitiationDto = {
      payment: updatedPayment,
      ...(providerResult.providerClientSecret === undefined
        ? {}
        : { providerClientSecret: providerResult.providerClientSecret }),
      ...(providerResult.providerOrderId === undefined ? {} : { providerOrderId: providerResult.providerOrderId }),
      ...(providerResult.publishableKey === undefined ? {} : { publishableKey: providerResult.publishableKey })
    };

    return {
      cart: result.cart,
      order: result.order,
      payment
    };
  }

  private async createProviderIntentSafely(
    result: { readonly cart: CartDto; readonly order: OrderDto; readonly payment: PaymentDto },
    provider: PaymentProvider
  ): Promise<CheckoutResultDto> {
    return this.createProviderIntent(result, provider);
  }

  private async updateProviderPayment(payment: PaymentDto, providerPaymentId: string): Promise<PaymentDto> {
    const updated = await this.prisma.payment.update({
      where: {
        id: payment.id
      },
      data: {
        providerPaymentId
      }
    });

    if (updated.tenantId !== payment.tenantId) {
      throw checkoutPaymentConflictError();
    }

    return toPaymentDto(updated);
  }

  private async persistCartSnapshot(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    cart: CartDto
  ): Promise<CartDto> {
    if (cart.id !== input.cartId || cart.tenantId !== input.tenantId || cart.userId !== input.userId) {
      throw checkoutCartMismatchError();
    }

    if (cart.items.length === 0) {
      throw checkoutCartEmptyError();
    }

    const existing = await tx.cart.findFirst({
      where: {
        id: input.cartId,
        tenantId: input.tenantId,
        userId: input.userId,
        deletedAt: null
      },
      select: {
        status: true
      }
    });

    if (existing === null) {
      throw checkoutCartNotFoundError();
    }

    if (existing.status !== "active") {
      throw checkoutCartAlreadyCheckedOutError();
    }

    await tx.cart.update({
      where: { id: input.cartId },
      data: {
        version: cart.version,
        expiresAt: new Date(cart.expiresAt),
        lastSyncedAt: new Date()
      }
    });

    return cart;
  }

  private async getVariantSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: readonly CartItemDto[]
  ): Promise<Map<string, ProductVariantSnapshot>> {
    if (items.length === 0) {
      return new Map<string, ProductVariantSnapshot>();
    }

    const variants = await tx.productVariant.findMany({
      where: {
        tenantId,
        id: {
          in: items.map((item) => item.variantId)
        },
        status: "active",
        deletedAt: null
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        name: true,
        price: true,
        currency: true
      }
    });
    const byId = new Map<string, ProductVariantSnapshot>(variants.map((variant) => [variant.id, variant]));

    if (byId.size !== new Set(items.map((item) => item.variantId)).size) {
      throw checkoutCartMismatchError();
    }

    return byId;
  }

  private async persistCartItems(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    cart: CartDto,
    variants: Map<string, ProductVariantSnapshot>
  ): Promise<CartItemSnapshot[]> {
    const now = new Date();
    const activeVariantIds = cart.items.map((item) => item.variantId);
    await tx.cartItem.updateMany({
      where: {
        tenantId: input.tenantId,
        cartId: input.cartId,
        deletedAt: null,
        variantId: {
          notIn: activeVariantIds
        }
      },
      data: {
        deletedAt: now
      }
    });

    const rows: CartItemSnapshot[] = [];

    for (const item of cart.items) {
      const variant = variants.get(item.variantId);

      if (variant === undefined || variant.productId !== item.productId) {
        throw checkoutCartMismatchError();
      }

      const row = await tx.cartItem.upsert({
        where: {
          tenantId_cartId_variantId: {
            tenantId: input.tenantId,
            cartId: input.cartId,
            variantId: item.variantId
          }
        },
        create: {
          tenantId: input.tenantId,
          cartId: input.cartId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: variant.price,
          currency: variant.currency
        },
        update: {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: variant.price,
          currency: variant.currency,
          deletedAt: null
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          quantity: true
        }
      });
      const reservations = await tx.inventoryReservation.findMany({
        where: {
          tenantId: input.tenantId,
          cartItemId: row.id,
          status: "active",
          orderItemId: null,
          expiresAt: {
            gt: now
          },
          deletedAt: null
        },
        select: {
          id: true,
          inventoryItemId: true,
          variantId: true,
          quantity: true,
          expiresAt: true
        },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }]
      });
      rows.push({
        ...row,
        reservations
      });
    }

    return rows;
  }

  private async reserveCartItems(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    cartItems: readonly CartItemSnapshot[]
  ): Promise<Map<string, readonly ReservationSnapshot[]>> {
    const reservationsByCartItemId = new Map<string, readonly ReservationSnapshot[]>();

    for (const cartItem of cartItems) {
      const activeQuantity = sumReservationQuantity(cartItem.reservations);

      if (activeQuantity === cartItem.quantity) {
        if (cartItem.reservations.some((reservation) => reservation.variantId !== cartItem.variantId)) {
          throw checkoutInventoryUnavailableError();
        }
        reservationsByCartItemId.set(cartItem.id, cartItem.reservations);
        continue;
      }

      await this.releaseCartItemReservations(tx, input.tenantId, cartItem.reservations);

      const reserved = await this.reserveCartItem(tx, input, cartItem);
      reservationsByCartItemId.set(cartItem.id, [reserved]);
    }

    return reservationsByCartItemId;
  }

  private async releaseCartItemReservations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    reservations: readonly ReservationSnapshot[]
  ): Promise<void> {
    for (const reservation of reservations) {
      const released = await tx.inventoryReservation.updateMany({
        where: {
          id: reservation.id,
          tenantId,
          status: "active",
          orderItemId: null
        },
        data: {
          status: "released",
          releasedAt: new Date()
        }
      });

      if (released.count !== 1) {
        throw checkoutInventoryUnavailableError();
      }

      const releasedInventory = await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "reserved" = "reserved" - ${reservation.quantity},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${reservation.inventoryItemId}::uuid
          AND "tenantId" = ${tenantId}::uuid
          AND "variantId" = ${reservation.variantId}::uuid
          AND "reserved" >= ${reservation.quantity}
      `;

      if (releasedInventory !== 1) {
        throw checkoutInventoryUnavailableError();
      }
    }
  }

  private async reserveCartItem(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    cartItem: CartItemSnapshot
  ): Promise<ReservationSnapshot> {
    const updatedItems = await tx.$executeRaw`
      UPDATE "InventoryItem"
      SET "reserved" = "reserved" + ${cartItem.quantity},
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE "tenantId" = ${input.tenantId}::uuid
        AND "variantId" = ${cartItem.variantId}::uuid
        AND "deletedAt" IS NULL
        AND ("quantity" - "reserved" - "safetyStock") >= ${cartItem.quantity}
    `;

    if (updatedItems !== 1) {
      throw checkoutInventoryUnavailableError();
    }

    const inventoryItem = await tx.inventoryItem.findFirst({
      where: {
        tenantId: input.tenantId,
        variantId: cartItem.variantId,
        deletedAt: null
      }
    });

    if (inventoryItem === null) {
      throw checkoutInventoryUnavailableError();
    }

    return tx.inventoryReservation.create({
      data: {
        tenantId: input.tenantId,
        inventoryItemId: inventoryItem.id,
        variantId: cartItem.variantId,
        cartItemId: cartItem.id,
        idempotencyKey: `checkout:${input.idempotencyKey}:${cartItem.id}`,
        quantity: cartItem.quantity,
        expiresAt: new Date(Date.now() + reservationTtlMs)
      },
      select: {
        id: true,
        inventoryItemId: true,
        variantId: true,
        quantity: true,
        expiresAt: true
      }
    });
  }

  private async createOrder(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    actor: OrderActor,
    cart: CartDto,
    variants: Map<string, ProductVariantSnapshot>
  ): Promise<OrderRow> {
    const orderItems = cart.items.map((item) => {
      const variant = variants.get(item.variantId);

      if (variant === undefined) {
        throw checkoutCartMismatchError();
      }

      return {
        productId: item.productId,
        variantId: item.variantId,
        sku: variant.sku,
        name: variant.name,
        quantity: item.quantity,
        unitPrice: variant.price,
        totalAmount: multiplyMoney(variant.price.toString(), item.quantity),
        currency: variant.currency
      };
    });
    const currencies = new Set(orderItems.map((item) => item.currency));

    if (currencies.size !== 1) {
      throw checkoutCartMismatchError();
    }

    const subtotalAmount = sumMoney(orderItems.map((item) => item.totalAmount));
    const currency = orderItems[0]?.currency;

    if (currency === undefined) {
      throw checkoutCartEmptyError();
    }

    const order = await tx.order.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        cartId: input.cartId,
        orderNumber: createOrderNumber(),
        email: input.email,
        subtotalAmount,
        taxAmount: "0.00",
        shippingAmount: "0.00",
        discountAmount: "0.00",
        totalAmount: subtotalAmount,
        currency,
        shippingAddress: toJsonObject(input.shippingAddress),
        ...(input.billingAddress === undefined ? {} : { billingAddress: toJsonObject(input.billingAddress) }),
        items: {
          createMany: {
            data: orderItems.map((item) => ({
              tenantId: input.tenantId,
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount,
              currency: item.currency
            }))
          }
        }
      },
      include: orderInclude
    });

    await tx.orderEvent.create({
      data: {
        tenantId: input.tenantId,
        orderId: order.id,
        type: "created",
        afterStatus: "pending",
        ...(actor.userId === undefined ? {} : { actorUserId: actor.userId }),
        ...(actor.requestId === undefined ? {} : { requestId: actor.requestId }),
        metadata: {
          checkoutIdempotencyKey: input.idempotencyKey
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        action: "order",
        entityType: "Order",
        entityId: order.id,
        ...(actor.userId === undefined ? {} : { actorUserId: actor.userId }),
        ...(actor.requestId === undefined ? {} : { requestId: actor.requestId }),
        ...(actor.ipAddress === undefined ? {} : { ipAddress: actor.ipAddress }),
        ...(actor.userAgent === undefined ? {} : { userAgent: actor.userAgent }),
        after: {
          status: "pending",
          totalAmount: subtotalAmount
        },
        metadata: {
          event: "checkout_started"
        }
      }
    });

    const createdOrder = await tx.order.findFirst({
      where: {
        id: order.id,
        tenantId: input.tenantId,
        deletedAt: null
      },
      include: orderInclude
    });

    if (createdOrder === null) {
      throw checkoutCartMismatchError();
    }

    return createdOrder;
  }

  private async linkReservationsToOrderItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    order: OrderRow,
    cartItems: readonly CartItemSnapshot[],
    reservations: Map<string, readonly ReservationSnapshot[]>
  ): Promise<void> {
    const cartItemsByProductVariant = new Map(cartItems.map((item) => [cartItemKey(item.productId, item.variantId), item]));

    for (const orderItem of order.items) {
      const cartItem = cartItemsByProductVariant.get(cartItemKey(orderItem.productId, orderItem.variantId));

      if (cartItem === undefined) {
        throw checkoutInventoryUnavailableError();
      }

      const itemReservations = reservations.get(cartItem.id) ?? [];

      if (sumReservationQuantity(itemReservations) !== orderItem.quantity) {
        throw checkoutInventoryUnavailableError();
      }

      if (itemReservations.some((reservation) => reservation.variantId !== orderItem.variantId)) {
        throw checkoutInventoryUnavailableError();
      }

      if (itemReservations.length === 0) {
        throw checkoutInventoryUnavailableError();
      }

      const linked = await tx.inventoryReservation.updateMany({
        where: {
          id: {
            in: itemReservations.map((reservation) => reservation.id)
          },
          tenantId,
          cartItemId: cartItem.id,
          orderItemId: null,
          status: "active"
        },
        data: {
          cartItemId: null,
          orderItemId: orderItem.id
        }
      });

      if (linked.count !== itemReservations.length) {
        throw checkoutInventoryUnavailableError();
      }
    }
  }

  private async createLocalPayment(
    tx: Prisma.TransactionClient,
    input: StartCheckoutBody,
    order: OrderRow
  ): Promise<PaymentRow> {
    return tx.payment.create({
      data: {
        tenantId: input.tenantId,
        orderId: order.id,
        provider: input.provider ?? this.env.PAYMENT_PROVIDER,
        amount: order.totalAmount.toString(),
        currency: order.currency,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          initiatedBy: "checkout"
        }
      }
    });
  }
}
