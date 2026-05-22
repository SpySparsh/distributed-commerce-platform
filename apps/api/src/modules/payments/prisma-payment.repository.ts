import { Prisma, type PrismaClient } from "@ecommerce/database";
import { createPaymentCompletedEvent } from "@ecommerce/events";
import { paymentNotFoundError } from "./payment.errors.js";
import type {
  ApplyPaymentWebhookInput,
  CreatePaymentInput,
  OrderConfirmationDto,
  OrderConfirmationItemDto,
  PaymentRepository,
  PaymentWebhookApplicationResult,
  PaymentWebhookLookupInput,
  PaymentWebhookEventDto,
  RecordWebhookInput,
  UpdateProviderPaymentInput,
} from "./payment.repository.js";
import type {
  PaymentDto,
  PaymentProvider,
  PaymentStatus,
  PaymentWebhookStatus
} from "./payment.types.js";

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

interface PaymentWebhookEventRow {
  readonly id: string;
  readonly providerEventId: string;
  readonly status: PaymentWebhookStatus;
  readonly processedAt: Date | null;
}

interface PaymentTransactionClient {
  readonly payment: {
    create(args: unknown): Promise<PaymentRow>;
    findFirst(args: unknown): Promise<PaymentRow | null>;
    update(args: unknown): Promise<PaymentRow>;
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
  readonly paymentWebhookEvent: {
    create(args: unknown): Promise<PaymentWebhookEventRow>;
    findFirst(args: unknown): Promise<PaymentWebhookEventRow | null>;
    update(args: unknown): Promise<PaymentWebhookEventRow>;
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
  readonly domainEventLog: {
    create(args: unknown): Promise<unknown>;
  };
  readonly order: {
    findFirst(args: unknown): Promise<{ readonly cartId: string | null; readonly status?: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
  readonly cart: {
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
}

const toMetadata = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const toJsonObject = (value: Record<string, unknown>): Prisma.InputJsonObject =>
  value as Prisma.InputJsonObject;

const toSupportedPaymentProvider = (provider: string): PaymentProvider => {
  if (provider === "stripe") {
    return provider;
  }

  throw Object.assign(new Error(`Unsupported payment provider: ${provider}`), {
    code: "UNSUPPORTED_PAYMENT_PROVIDER",
    statusCode: 500
  });
};

const toPaymentDto = (row: PaymentRow): PaymentDto => ({
  id: row.id,
  tenantId: row.tenantId,
  orderId: row.orderId,
  provider: toSupportedPaymentProvider(row.provider),
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
  metadata: toMetadata(row.metadata),
  ...(row.authorizedAt === null ? {} : { authorizedAt: row.authorizedAt.toISOString() }),
  ...(row.capturedAt === null ? {} : { capturedAt: row.capturedAt.toISOString() }),
  ...(row.failedAt === null ? {} : { failedAt: row.failedAt.toISOString() }),
  ...(row.refundedAt === null ? {} : { refundedAt: row.refundedAt.toISOString() }),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const toWebhookDto = (row: PaymentWebhookEventRow): PaymentWebhookEventDto => ({
  id: row.id,
  providerEventId: row.providerEventId,
  status: row.status,
  ...(row.processedAt === null ? {} : { processedAt: row.processedAt.toISOString() })
});

const statusTimestamp = (status: PaymentStatus, now: Date): Record<string, Date> => {
  switch (status) {
    case "authorized":
      return { authorizedAt: now };
    case "captured":
      return { capturedAt: now };
    case "failed":
      return { failedAt: now };
    case "refunded":
      return { refundedAt: now };
    case "pending":
    case "cancelled":
      return {};
  }
};

const sumReservationQuantity = (
  reservations: readonly { readonly quantity: number }[]
): number => reservations.reduce((total, reservation) => total + reservation.quantity, 0);

const toConfirmationItem = (item: {
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: { toString(): string };
  readonly totalAmount: { toString(): string };
}): OrderConfirmationItemDto => ({
  name: item.name,
  sku: item.sku,
  quantity: item.quantity,
  unitPrice: item.unitPrice.toString(),
  totalAmount: item.totalAmount.toString()
});

const toConfirmationOrder = (order: {
  readonly id: string;
  readonly orderNumber: string;
  readonly email: string;
  readonly status: string;
  readonly totalAmount: { toString(): string };
  readonly currency: string;
  readonly items: readonly {
    readonly name: string;
    readonly sku: string;
    readonly quantity: number;
    readonly unitPrice: { toString(): string };
    readonly totalAmount: { toString(): string };
  }[];
}, beforeStatus: string): OrderConfirmationDto => ({
  id: order.id,
  orderNumber: order.orderNumber,
  email: order.email,
  beforeStatus,
  afterStatus: order.status,
  totalAmount: order.totalAmount.toString(),
  currency: order.currency,
  items: order.items.map(toConfirmationItem)
});

const inventoryNotReservedError = (): Error =>
  Object.assign(new Error("Reserved inventory is required before marking the order paid"), {
    code: "ORDER_INVENTORY_NOT_RESERVED",
    statusCode: 409
  });

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentDto> {
    const existing = await this.prisma.payment.findFirst({
      where: {
        tenantId: input.tenantId,
        idempotencyKey: input.idempotencyKey,
        deletedAt: null
      }
    });

    if (existing !== null) {
      return toPaymentDto(existing);
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        provider: input.provider,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          initiatedBy: "api"
        }
      }
    });

    return toPaymentDto(payment);
  }

  async findPaymentById(tenantId: string, paymentId: string): Promise<PaymentDto | undefined> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId,
        deletedAt: null
      }
    });

    return payment === null ? undefined : toPaymentDto(payment);
  }

  async findPaymentByProviderPaymentId(
    provider: PaymentProvider,
    providerPaymentId: string
  ): Promise<PaymentDto | undefined> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider,
        providerPaymentId,
        deletedAt: null
      }
    });

    return payment === null ? undefined : toPaymentDto(payment);
  }

  async findPaymentByWebhookReference(input: PaymentWebhookLookupInput): Promise<PaymentDto | undefined> {
    const references = [
      ...(input.providerPaymentId === undefined ? [] : [{ providerPaymentId: input.providerPaymentId }]),
      ...(input.paymentId === undefined ? [] : [{ id: input.paymentId }]),
      ...(input.orderId === undefined ? [] : [{ orderId: input.orderId }])
    ];

    if (references.length === 0) {
      return undefined;
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: input.provider,
        deletedAt: null,
        ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
        OR: references
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return payment === null ? undefined : toPaymentDto(payment);
  }

  async updateProviderPayment(input: UpdateProviderPaymentInput): Promise<PaymentDto> {
    const payment = await this.prisma.payment.update({
      where: {
        id: input.paymentId
      },
      data: {
        ...(input.providerPaymentId === undefined ? {} : { providerPaymentId: input.providerPaymentId }),
        ...(input.providerTransactionId === undefined ? {} : { providerTransactionId: input.providerTransactionId })
      }
    });

    if (payment.tenantId !== input.tenantId) {
      throw paymentNotFoundError();
    }

    return toPaymentDto(payment);
  }

  async recordWebhook(input: RecordWebhookInput): Promise<PaymentWebhookEventDto> {
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          providerEventId: input.webhook.providerEventId,
          eventType: input.webhook.eventType,
          payload: toJsonObject(input.webhook.payload)
        }
      });

      return toWebhookDto(event);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const existing = await this.prisma.paymentWebhookEvent.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          providerEventId: input.webhook.providerEventId,
          deletedAt: null
        }
      });

      if (existing === null) {
        throw error;
      }

      return toWebhookDto(existing);
    }
  }

  async applyWebhook(input: ApplyPaymentWebhookInput): Promise<PaymentWebhookApplicationResult | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.paymentWebhookEvent.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          providerEventId: input.webhook.providerEventId,
          deletedAt: null
        }
      });

      if (event === null || event.status !== "received") {
        return undefined;
      }

      const claimed = await tx.paymentWebhookEvent.updateMany({
        where: {
          id: event.id,
          status: "received"
        },
        data: {
          status: "processed",
          processedAt: new Date()
        }
      });

      if (claimed.count !== 1) {
        return undefined;
      }

      const payment = await tx.payment.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          OR: [
            ...(input.webhook.providerPaymentId === undefined
              ? []
              : [{ providerPaymentId: input.webhook.providerPaymentId }]),
            ...(input.webhook.paymentId === undefined ? [] : [{ id: input.webhook.paymentId }]),
            ...(input.webhook.orderId === undefined ? [] : [{ orderId: input.webhook.orderId }])
          ],
          deletedAt: null
        }
      });

      if (payment === null) {
        await tx.paymentWebhookEvent.update({
          where: {
            id: event.id
          },
          data: {
            status: "ignored",
            processedAt: new Date()
          }
        });
        return undefined;
      }

      const now = new Date();
      const updated = await tx.payment.update({
        where: {
          id: payment.id
        },
        data: {
          status: input.webhook.status,
          ...(input.webhook.providerTransactionId === undefined
            ? {}
            : { providerTransactionId: input.webhook.providerTransactionId }),
          ...statusTimestamp(input.webhook.status, now),
          ...(input.webhook.status === "failed"
            ? {
                failureCode: input.webhook.eventType,
                failureMessage: "Payment provider reported failure",
                retryCount: {
                  increment: 1
                },
                nextRetryAt: new Date(now.getTime() + 5 * 60 * 1_000)
              }
            : {})
        }
      });

      const order = await tx.order.findFirst({
        where: {
          id: payment.orderId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true,
          orderNumber: true,
          email: true,
          cartId: true,
          status: true,
          totalAmount: true,
          currency: true,
          items: {
            where: {
              deletedAt: null
            },
            select: {
              id: true,
              variantId: true,
              sku: true,
              name: true,
              quantity: true,
              unitPrice: true,
              totalAmount: true
            }
          }
        }
      });

      let confirmationOrder: OrderConfirmationDto | undefined;
      let inventoryConsumed = false;
      let inventoryReleased = false;

      if (input.webhook.status === "captured" && order !== null && payment.status !== "captured") {
        for (const item of order.items) {
          const activeReservations = await tx.inventoryReservation.findMany({
            where: {
              tenantId: input.tenantId,
              orderItemId: item.id,
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

          if (activeReservations.length === 0 || sumReservationQuantity(activeReservations) !== item.quantity) {
            throw inventoryNotReservedError();
          }

          const reservationGroups = new Map<string, number>();

          for (const reservation of activeReservations) {
            if (reservation.variantId !== item.variantId) {
              throw inventoryNotReservedError();
            }

            reservationGroups.set(
              reservation.inventoryItemId,
              (reservationGroups.get(reservation.inventoryItemId) ?? 0) + reservation.quantity
            );
          }

          for (const [inventoryItemId, quantity] of reservationGroups) {
            const consumedItems = await tx.$executeRaw`
              UPDATE "InventoryItem"
              SET "quantity" = "quantity" - ${quantity},
                  "reserved" = "reserved" - ${quantity},
                  "version" = "version" + 1,
                  "updatedAt" = NOW()
              WHERE "id" = ${inventoryItemId}::uuid
                AND "tenantId" = ${input.tenantId}::uuid
                AND "variantId" = ${item.variantId}::uuid
                AND "quantity" >= ${quantity}
                AND "reserved" >= ${quantity}
            `;

            if (consumedItems !== 1) {
              throw inventoryNotReservedError();
            }
          }

          const reservationIds = activeReservations.map((reservation) => reservation.id);

          if (reservationIds.length === 0) {
            throw inventoryNotReservedError();
          }

          const consumedReservations = await tx.inventoryReservation.updateMany({
            where: {
              id: {
                in: reservationIds
              },
              tenantId: input.tenantId,
              orderItemId: item.id,
              status: "active"
            },
            data: {
              status: "consumed",
              consumedAt: now
            }
          });

          if (consumedReservations.count !== activeReservations.length) {
            throw inventoryNotReservedError();
          }
        }

        inventoryConsumed = true;

        const paidOrder = await tx.order.update({
          where: {
            id: payment.orderId
          },
          data: {
            status: "paid",
            placedAt: now,
            version: {
              increment: 1
            }
          },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            status: true,
            totalAmount: true,
            currency: true,
            items: {
              where: {
                deletedAt: null
              },
              select: {
                name: true,
                sku: true,
                quantity: true,
                unitPrice: true,
                totalAmount: true
              }
            }
          }
        });

        confirmationOrder = toConfirmationOrder(paidOrder, order.status);

        await tx.orderEvent.create({
          data: {
            tenantId: input.tenantId,
            orderId: payment.orderId,
            type: "paid",
            beforeStatus: order.status,
            afterStatus: "paid",
            requestId: input.webhook.providerEventId,
            metadata: toJsonObject({
              paymentId: payment.id,
              providerEventId: input.webhook.providerEventId,
              providerPaymentId: input.webhook.providerPaymentId ?? null,
              providerTransactionId: input.webhook.providerTransactionId ?? null
            })
          }
        });

        await tx.orderEvent.create({
          data: {
            tenantId: input.tenantId,
            orderId: payment.orderId,
            type: "inventory_consumed",
            requestId: input.webhook.providerEventId,
            metadata: toJsonObject({
              paymentId: payment.id,
              itemCount: order.items.length
            })
          }
        });

        if (order.cartId !== null) {
          await tx.cart.updateMany({
            where: {
              id: order.cartId,
              tenantId: input.tenantId,
              status: "active",
              deletedAt: null
            },
            data: {
              status: "converted",
              lastSyncedAt: now
            }
          });
        }
      }

      if (input.webhook.status === "failed" && order !== null && !["paid", "fulfilled", "refunded", "cancelled"].includes(order.status)) {
        for (const item of order.items) {
          const activeReservations = await tx.inventoryReservation.findMany({
            where: {
              tenantId: input.tenantId,
              orderItemId: item.id,
              status: "active",
              deletedAt: null
            },
            select: {
              id: true,
              inventoryItemId: true,
              quantity: true
            }
          });

          const reservationGroups = new Map<string, number>();

          for (const reservation of activeReservations) {
            reservationGroups.set(
              reservation.inventoryItemId,
              (reservationGroups.get(reservation.inventoryItemId) ?? 0) + reservation.quantity
            );
          }

          for (const [inventoryItemId, quantity] of reservationGroups) {
            const releasedItems = await tx.$executeRaw`
              UPDATE "InventoryItem"
              SET "reserved" = "reserved" - ${quantity},
                  "version" = "version" + 1,
                  "updatedAt" = NOW()
              WHERE "id" = ${inventoryItemId}::uuid
                AND "tenantId" = ${input.tenantId}::uuid
                AND "reserved" >= ${quantity}
            `;

            if (releasedItems !== 1) {
              throw inventoryNotReservedError();
            }
          }

          const reservationIds = activeReservations.map((reservation) => reservation.id);

          if (reservationIds.length > 0) {
            const releasedReservations = await tx.inventoryReservation.updateMany({
              where: {
                id: {
                  in: reservationIds
                },
                tenantId: input.tenantId,
                orderItemId: item.id,
                status: "active"
              },
              data: {
                status: "released",
                releasedAt: now
              }
            });

            if (releasedReservations.count !== activeReservations.length) {
              throw inventoryNotReservedError();
            }

            inventoryReleased = true;
          }
        }

        const cancelledOrder = await tx.order.update({
          where: {
            id: payment.orderId
          },
          data: {
            status: "cancelled",
            version: {
              increment: 1
            }
          },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            status: true,
            totalAmount: true,
            currency: true,
            items: {
              where: {
                deletedAt: null
              },
              select: {
                name: true,
                sku: true,
                quantity: true,
                unitPrice: true,
                totalAmount: true
              }
            }
          }
        });

        confirmationOrder = toConfirmationOrder(cancelledOrder, order.status);

        await tx.orderEvent.create({
          data: {
            tenantId: input.tenantId,
            orderId: payment.orderId,
            type: "cancelled",
            beforeStatus: order.status,
            afterStatus: "cancelled",
            requestId: input.webhook.providerEventId,
            reason: "Payment provider reported failure or session expiry",
            metadata: toJsonObject({
              paymentId: payment.id,
              providerEventId: input.webhook.providerEventId
            })
          }
        });
      }

      if (input.webhook.status === "captured" && payment.status !== "captured") {
        const event = createPaymentCompletedEvent(
          {
            tenantId: updated.tenantId,
            aggregateId: updated.id,
            correlationId: input.webhook.providerEventId,
            occurredAt: now
          },
          {
            paymentId: updated.id,
            orderId: updated.orderId,
            provider: toSupportedPaymentProvider(updated.provider),
            amount: updated.amount.toString(),
            currency: updated.currency,
            ...(updated.providerPaymentId === null ? {} : { providerPaymentId: updated.providerPaymentId })
          }
        );

        await tx.domainEventLog.create({
          data: {
            id: event.metadata.eventId,
            tenantId: event.metadata.tenantId,
            name: event.name,
            aggregateType: event.metadata.aggregateType,
            aggregateId: event.metadata.aggregateId,
            ...(event.metadata.correlationId === undefined ? {} : { correlationId: event.metadata.correlationId }),
            schemaVersion: event.metadata.schemaVersion,
            payload: toJsonObject(event.payload),
            occurredAt: new Date(event.metadata.occurredAt)
          }
        });
      }

      return {
        payment: toPaymentDto(updated),
        ...(confirmationOrder === undefined ? {} : { order: confirmationOrder }),
        inventoryConsumed,
        inventoryReleased
      };
    });
  }

  async markPaymentRetryScheduled(tenantId: string, paymentId: string, nextRetryAt: Date): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        tenantId,
        status: "failed"
      },
      data: {
        retryCount: {
          increment: 1
        },
        nextRetryAt
      }
    });
  }
}
