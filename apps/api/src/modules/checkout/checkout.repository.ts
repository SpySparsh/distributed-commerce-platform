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
import type { StartBuyNowCheckoutBody, StartCheckoutBody } from "./checkout.schemas.js";
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

interface CheckoutPersistenceResult {
  readonly cart?: CartDto;
  readonly order: OrderDto;
  readonly payment: PaymentDto;
}

const orderInclude = {
  items: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.OrderInclude;

const reservationTtlMs = 15 * 60 * 1000;
const stalePaymentMs = 10 * 60 * 1000;

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

const isRetryablePaymentStatus = (status: PaymentStatus): boolean =>
  status === "failed" || status === "cancelled";

const isStalePayment = (payment: Pick<PaymentRow, "status" | "createdAt">): boolean =>
  payment.status === "pending" && Date.now() - payment.createdAt.getTime() > stalePaymentMs;

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown checkout provider error";

const toErrorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

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
  if (provider === "stripe" || provider === "cod" || provider === "manual") {
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
  startBuyNowCheckout(input: StartBuyNowCheckoutBody, actor: OrderActor): Promise<CheckoutResultDto>;
}

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: ApiEnv
  ) {}

  async startCheckout(input: StartCheckoutBody, cart: CartDto | undefined, actor: OrderActor): Promise<CheckoutResultDto> {
    const existing = await this.findExistingCheckout(input.tenantId, input.idempotencyKey);

    if (existing !== undefined) {
      return this.createProviderIntentSafely(existing, input.provider ?? existing.payment.provider, {
        mode: "cart",
        requestId: actor.requestId
      });
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

    return this.createProviderIntentSafely(result, input.provider ?? result.payment.provider, {
      mode: "cart",
      requestId: actor.requestId
    });
  }

  async startBuyNowCheckout(input: StartBuyNowCheckoutBody, actor: OrderActor): Promise<CheckoutResultDto> {
    const existing = await this.findExistingCheckout(input.tenantId, input.idempotencyKey);

    if (existing !== undefined) {
      return this.createProviderIntentSafely(existing, input.provider ?? existing.payment.provider, {
        mode: "buy_now",
        requestId: actor.requestId
      });
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const variant = await tx.productVariant.findFirst({
          where: {
            id: input.variantId,
            productId: input.productId,
            tenantId: input.tenantId,
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

        if (variant === null) {
          throw checkoutCartMismatchError();
        }

        const updatedItems = await tx.$executeRaw`
          UPDATE "InventoryItem"
          SET "reserved" = "reserved" + ${input.quantity},
              "version" = "version" + 1,
              "updatedAt" = NOW()
          WHERE "tenantId" = ${input.tenantId}::uuid
            AND "variantId" = ${input.variantId}::uuid
            AND "deletedAt" IS NULL
            AND ("quantity" - "reserved" - "safetyStock") >= ${input.quantity}
        `;

        if (updatedItems !== 1) {
          throw checkoutInventoryUnavailableError();
        }

        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            tenantId: input.tenantId,
            variantId: input.variantId,
            deletedAt: null
          },
          select: {
            id: true
          }
        });

        if (inventoryItem === null) {
          throw checkoutInventoryUnavailableError();
        }

        const totalAmount = multiplyMoney(variant.price.toString(), input.quantity);
        const order = await tx.order.create({
          data: {
            tenantId: input.tenantId,
            userId: input.userId,
            orderNumber: createOrderNumber(),
            email: input.email,
            subtotalAmount: totalAmount,
            taxAmount: "0.00",
            shippingAmount: "0.00",
            discountAmount: "0.00",
            totalAmount,
            currency: variant.currency,
            shippingAddress: toJsonObject(input.shippingAddress),
            ...(input.billingAddress === undefined ? {} : { billingAddress: toJsonObject(input.billingAddress) }),
            items: {
              create: {
                tenantId: input.tenantId,
                productId: variant.productId,
                variantId: variant.id,
                sku: variant.sku,
                name: variant.name,
                quantity: input.quantity,
                unitPrice: variant.price,
                totalAmount,
                currency: variant.currency
              }
            }
          },
          include: orderInclude
        });
        const orderItem = order.items[0];

        if (orderItem === undefined) {
          throw checkoutCartMismatchError();
        }

        await tx.inventoryReservation.create({
          data: {
            tenantId: input.tenantId,
            inventoryItemId: inventoryItem.id,
            variantId: variant.id,
            orderItemId: orderItem.id,
            idempotencyKey: `buy-now:${input.idempotencyKey}:${variant.id}`,
            quantity: input.quantity,
            expiresAt: new Date(Date.now() + reservationTtlMs)
          }
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
              checkoutMode: "buy_now",
              checkoutIdempotencyKey: input.idempotencyKey
            }
          }
        });

        const payment = await this.createLocalPayment(tx, input, order);

        return {
          order: toOrderDto(order),
          payment: toPaymentDto(payment)
        };
      },
      {
        maxWait: 5_000,
        timeout: 20_000
      }
    );

    return this.createProviderIntentSafely(result, input.provider ?? result.payment.provider, {
      mode: "buy_now",
      requestId: actor.requestId
    });
  }

  private async findExistingCheckout(
    tenantId: string,
    idempotencyKey: string
  ): Promise<CheckoutPersistenceResult | undefined> {
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

    if (isRetryablePaymentStatus(payment.status) || isStalePayment(payment)) {
      await this.archiveFailedCheckoutAttempt(payment, isStalePayment(payment) ? "stale_checkout_retry" : "failed_checkout_retry");
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

    if (order === null) {
      throw checkoutPaymentConflictError();
    }

    const cart = order.cartId === null
      ? null
      : await this.prisma.cart.findFirst({
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

    if (order.cartId !== null && cart === null) {
      throw checkoutPaymentConflictError();
    }

    return {
      ...(cart === null ? {} : {
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
        }
      }),
      order: toOrderDto(order),
      payment: toPaymentDto(payment)
    };
  }

  private async createProviderIntent(
    result: CheckoutPersistenceResult,
    provider: PaymentProvider
  ): Promise<CheckoutResultDto> {
    if (result.payment.provider !== provider) {
      throw checkoutPaymentConflictError();
    }

    if (provider === "cod" || provider === "manual") {
      return {
        ...(result.cart === undefined ? {} : { cart: result.cart }),
        order: result.order,
        payment: {
          payment: result.payment
        }
      };
    }

    if (result.payment.providerPaymentId !== undefined) {
      console.info("CHECKOUT PROVIDER REUSE", {
        provider,
        paymentId: result.payment.id,
        orderId: result.payment.orderId,
        providerOrderId: result.payment.providerPaymentId
      });

      return {
        ...(result.cart === undefined ? {} : { cart: result.cart }),
        order: result.order,
        payment: {
          payment: result.payment,
          providerOrderId: result.payment.providerPaymentId
        }
      };
    }

    console.info("CHECKOUT PROVIDER INIT", {
      provider,
      paymentId: result.payment.id,
      orderId: result.payment.orderId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      stripeSecretConfigured: this.env.STRIPE_SECRET_KEY !== undefined
    });

    const providerClient = createPaymentProviderClient(provider, this.env);
    const providerResult = await providerClient.createPayment({
      tenantId: result.payment.tenantId,
      orderId: result.payment.orderId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      idempotencyKey: result.payment.idempotencyKey,
      paymentId: result.payment.id
    });

    console.info("CHECKOUT PROVIDER RESPONSE", {
      provider,
      paymentId: result.payment.id,
      orderId: result.payment.orderId,
      providerOrderId: providerResult.providerOrderId,
      hasClientSecret: providerResult.providerClientSecret !== undefined,
      hasPublishableKey: providerResult.publishableKey !== undefined
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
      ...(providerResult.providerCheckoutUrl === undefined
        ? {}
        : { providerCheckoutUrl: providerResult.providerCheckoutUrl }),
      ...(providerResult.providerOrderId === undefined ? {} : { providerOrderId: providerResult.providerOrderId }),
      ...(providerResult.publishableKey === undefined ? {} : { publishableKey: providerResult.publishableKey })
    };

    return {
      ...(result.cart === undefined ? {} : { cart: result.cart }),
      order: result.order,
      payment
    };
  }

  private async createProviderIntentSafely(
    result: CheckoutPersistenceResult,
    provider: PaymentProvider,
    context: {
      readonly mode: "cart" | "buy_now";
      readonly requestId?: string | undefined;
    }
  ): Promise<CheckoutResultDto> {
    try {
      return await this.createProviderIntent(result, provider);
    } catch (error) {
      if (!isImmediateSettlementProvider(provider)) {
        console.error("CHECKOUT PROVIDER INIT FAILED", {
          mode: context.mode,
          requestId: context.requestId,
          provider,
          paymentId: result.payment.id,
          orderId: result.order.id,
          amount: result.payment.amount,
          currency: result.payment.currency,
          providerOrderId: result.payment.providerPaymentId,
          message: toErrorMessage(error),
          stack: toErrorStack(error)
        });
        await this.cleanupFailedProviderInitialization(result, error);
      }

      throw error;
    }
  }

  private async archiveFailedCheckoutAttempt(payment: PaymentRow, reason: string): Promise<void> {
    const archivedKey = `${payment.idempotencyKey}:archived:${payment.id}`;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        idempotencyKey: archivedKey,
        status: payment.status === "pending" ? "failed" : payment.status,
        failureCode: reason,
        failureMessage: "Archived stale checkout attempt so a new checkout can be started",
        failedAt: payment.failedAt ?? new Date(),
        metadata: {
          ...toRecord(payment.metadata),
          archivedOriginalIdempotencyKey: payment.idempotencyKey,
          archivedReason: reason,
          archivedAt: new Date().toISOString()
        }
      }
    });
  }

  private async cleanupFailedProviderInitialization(
    result: CheckoutPersistenceResult,
    error: unknown
  ): Promise<void> {
    const message = toErrorMessage(error);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: result.payment.id },
        data: {
          status: "failed",
          failureCode: "PROVIDER_INIT_FAILED",
          failureMessage: message,
          failedAt: new Date(),
          idempotencyKey: `${result.payment.idempotencyKey}:failed:${result.payment.id}`,
          metadata: {
            ...result.payment.metadata,
            providerInitFailedAt: new Date().toISOString()
          }
        }
      });

      await tx.order.update({
        where: { id: result.order.id },
        data: {
          status: "cancelled",
          version: {
            increment: 1
          }
        }
      });

      await tx.orderEvent.create({
        data: {
          tenantId: result.order.tenantId,
          orderId: result.order.id,
          type: "cancelled",
          beforeStatus: result.order.status,
          afterStatus: "cancelled",
          reason: "Payment provider initialization failed",
          metadata: {
            paymentId: result.payment.id,
            failureMessage: message
          }
        }
      });

      const orderItemIds = result.order.items.map((item) => item.id);
      const reservations = orderItemIds.length === 0
        ? []
        : await tx.inventoryReservation.findMany({
            where: {
              tenantId: result.order.tenantId,
              orderItemId: {
                in: orderItemIds
              },
              status: "active",
              deletedAt: null
            },
            select: {
              id: true,
              inventoryItemId: true,
              variantId: true,
              quantity: true
            }
          });

      for (const reservation of reservations) {
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            status: "released",
            releasedAt: new Date()
          }
        });

        await tx.$executeRaw`
          UPDATE "InventoryItem"
          SET "reserved" = "reserved" - ${reservation.quantity},
              "version" = "version" + 1,
              "updatedAt" = NOW()
          WHERE "id" = ${reservation.inventoryItemId}::uuid
            AND "tenantId" = ${result.order.tenantId}::uuid
            AND "variantId" = ${reservation.variantId}::uuid
            AND "reserved" >= ${reservation.quantity}
        `;
      }
    });
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
    input: Pick<StartCheckoutBody, "tenantId" | "provider" | "idempotencyKey">,
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
