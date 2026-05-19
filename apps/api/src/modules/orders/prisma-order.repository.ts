import { randomUUID } from "node:crypto";
import {
  orderInventoryNotReservedError,
  orderNotFoundError,
  orderPaymentRequiredError
} from "./order.errors.js";
import type {
  OrderActor,
  OrderRepository,
  TransitionOrderInput
} from "./order.repository.js";
import type { CreateOrderBody } from "./order.schemas.js";
import { assertOrderTransition, toOrderEventType } from "./order.state-machine.js";
import type { OrderDto, OrderEventDto, OrderEventType, OrderStatus } from "./order.types.js";

interface OrderItemRow {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: { toString(): string };
  readonly totalAmount: { toString(): string };
  readonly currency: string;
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
  readonly items: readonly OrderItemRow[];
}

interface OrderEventRow {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly type: OrderEventType;
  readonly beforeStatus: OrderStatus | null;
  readonly afterStatus: OrderStatus | null;
  readonly actorUserId: string | null;
  readonly requestId: string | null;
  readonly reason: string | null;
  readonly metadata: unknown;
  readonly createdAt: Date;
}

interface PaymentRow {
  readonly id: string;
  readonly status: "pending" | "authorized" | "captured" | "failed" | "refunded" | "cancelled";
}

interface OrderTransactionClient {
  readonly $executeRaw: (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => Promise<number>;
  readonly order: {
    create(args: unknown): Promise<OrderRow>;
    findFirst(args: unknown): Promise<OrderRow | null>;
    update(args: unknown): Promise<OrderRow>;
  };
  readonly orderEvent: {
    create(args: unknown): Promise<OrderEventRow>;
    findMany(args: unknown): Promise<OrderEventRow[]>;
  };
  readonly payment: {
    findFirst(args: unknown): Promise<PaymentRow | null>;
  };
  readonly inventoryReservation: {
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
  readonly auditLog: {
    create(args: unknown): Promise<unknown>;
  };
}

interface OrderPrismaClient extends OrderTransactionClient {
  readonly $transaction: <T>(
    callback: (tx: OrderTransactionClient) => Promise<T>,
    options?: unknown
  ) => Promise<T>;
}

const orderInclude = {
  items: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" }
  }
} as const;

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const createOrderNumber = (): string => `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

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

const toEventDto = (row: OrderEventRow): OrderEventDto => ({
  id: row.id,
  tenantId: row.tenantId,
  orderId: row.orderId,
  type: row.type,
  ...(row.beforeStatus === null ? {} : { beforeStatus: row.beforeStatus }),
  ...(row.afterStatus === null ? {} : { afterStatus: row.afterStatus }),
  ...(row.actorUserId === null ? {} : { actorUserId: row.actorUserId }),
  ...(row.requestId === null ? {} : { requestId: row.requestId }),
  ...(row.reason === null ? {} : { reason: row.reason }),
  metadata: toRecord(row.metadata),
  createdAt: row.createdAt.toISOString()
});

const eventData = (
  tenantId: string,
  orderId: string,
  type: OrderEventType,
  actor: OrderActor,
  input: {
    readonly beforeStatus?: OrderStatus;
    readonly afterStatus?: OrderStatus;
    readonly reason?: string;
    readonly metadata?: Record<string, unknown>;
  } = {}
): Record<string, unknown> => ({
  tenantId,
  orderId,
  type,
  ...(input.beforeStatus === undefined ? {} : { beforeStatus: input.beforeStatus }),
  ...(input.afterStatus === undefined ? {} : { afterStatus: input.afterStatus }),
  ...(actor.userId === undefined ? {} : { actorUserId: actor.userId }),
  ...(actor.requestId === undefined ? {} : { requestId: actor.requestId }),
  ...(input.reason === undefined ? {} : { reason: input.reason }),
  metadata: input.metadata ?? {}
});

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: OrderPrismaClient) {}

  async createOrder(input: CreateOrderBody, actor: OrderActor): Promise<OrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId: input.tenantId,
          orderNumber: createOrderNumber(),
          email: input.email,
          subtotalAmount: input.subtotalAmount,
          taxAmount: input.taxAmount,
          shippingAmount: input.shippingAmount,
          discountAmount: input.discountAmount,
          totalAmount: input.totalAmount,
          currency: input.currency,
          shippingAddress: input.shippingAddress,
          ...(input.userId === undefined ? {} : { userId: input.userId }),
          ...(input.cartId === undefined ? {} : { cartId: input.cartId }),
          ...(input.billingAddress === undefined ? {} : { billingAddress: input.billingAddress }),
          items: {
            create: input.items.map((item) => ({
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
        },
        include: orderInclude
      });

      await tx.orderEvent.create({
        data: eventData(input.tenantId, order.id, "created", actor, {
          afterStatus: "pending",
          metadata: {
            idempotencyKey: input.idempotencyKey ?? null
          }
        })
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
            totalAmount: input.totalAmount
          },
          metadata: {
            event: "created"
          }
        }
      });

      return toOrderDto(order);
    });
  }

  async findOrder(tenantId: string, orderId: string): Promise<OrderDto | undefined> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        deletedAt: null
      },
      include: orderInclude
    });

    return order === null ? undefined : toOrderDto(order);
  }

  async transitionOrder(input: TransitionOrderInput): Promise<OrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: input.orderId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        include: orderInclude
      });

      if (order === null) {
        throw orderNotFoundError();
      }

      assertOrderTransition(order.status, input.nextStatus);

      if (input.nextStatus === "paid") {
        const payment = input.paymentId === undefined
          ? null
          : await tx.payment.findFirst({
              where: {
                id: input.paymentId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                deletedAt: null
              }
            });

        if (payment === null || !["authorized", "captured"].includes(payment.status)) {
          throw orderPaymentRequiredError();
        }
      }

      const now = new Date();
      const updated = await tx.order.update({
        where: {
          id: input.orderId
        },
        data: {
          status: input.nextStatus,
          ...(input.nextStatus === "paid" ? { placedAt: now } : {})
        },
        include: orderInclude
      });

      await tx.orderEvent.create({
        data: eventData(input.tenantId, input.orderId, toOrderEventType(input.nextStatus), input.actor, {
          beforeStatus: order.status,
          afterStatus: input.nextStatus,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          metadata: {
            paymentId: input.paymentId ?? null
          }
        })
      });

      if (input.nextStatus === "paid") {
        for (const item of order.items) {
          const consumedItems = await tx.$executeRaw`
            UPDATE "InventoryItem"
            SET "quantity" = GREATEST("quantity" - ${item.quantity}, 0),
                "reserved" = GREATEST("reserved" - ${item.quantity}, 0),
                "version" = "version" + 1,
                "updatedAt" = NOW()
            WHERE "tenantId" = ${input.tenantId}::uuid
              AND "variantId" = ${item.variantId}::uuid
              AND "reserved" >= ${item.quantity}
          `;

          if (consumedItems !== 1) {
            throw orderInventoryNotReservedError();
          }
        }
        await tx.inventoryReservation.updateMany({
          where: {
            tenantId: input.tenantId,
            orderItemId: {
              in: order.items.map((item) => item.id)
            },
            status: "active"
          },
          data: {
            status: "consumed",
            consumedAt: now
          }
        });
        await tx.orderEvent.create({
          data: eventData(input.tenantId, input.orderId, "inventory_consumed", input.actor, {
            metadata: {
              itemCount: order.items.length
            }
          })
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          action: "order",
          entityType: "Order",
          entityId: input.orderId,
          ...(input.actor.userId === undefined ? {} : { actorUserId: input.actor.userId }),
          ...(input.actor.requestId === undefined ? {} : { requestId: input.actor.requestId }),
          before: {
            status: order.status
          },
          after: {
            status: input.nextStatus
          },
          metadata: {
            event: "transition",
            paymentId: input.paymentId ?? null
          }
        }
      });

      return toOrderDto(updated);
    });
  }

  async listOrderEvents(tenantId: string, orderId: string): Promise<readonly OrderEventDto[]> {
    const rows = await this.prisma.orderEvent.findMany({
      where: {
        tenantId,
        orderId,
        deletedAt: null
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return rows.map(toEventDto);
  }

  async markInvoiceRequested(tenantId: string, orderId: string, actor: OrderActor): Promise<OrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          tenantId,
          deletedAt: null
        },
        include: orderInclude
      });

      if (order === null) {
        throw orderNotFoundError();
      }

      await tx.orderEvent.create({
        data: eventData(tenantId, orderId, "invoice_requested", actor, {
          afterStatus: order.status
        })
      });

      return toOrderDto(order);
    });
  }
}
