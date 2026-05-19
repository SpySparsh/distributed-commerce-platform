import { paymentNotFoundError } from "./payment.errors.js";
import type {
  ApplyPaymentWebhookInput,
  CreatePaymentInput,
  PaymentRepository,
  PaymentWebhookEventDto,
  RecordWebhookInput,
  UpdateProviderPaymentInput
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
  readonly provider: PaymentProvider;
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
  };
  readonly order: {
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
}

interface PaymentPrismaClient extends PaymentTransactionClient {
  readonly $transaction: <T>(
    callback: (tx: PaymentTransactionClient) => Promise<T>,
    options?: unknown
  ) => Promise<T>;
}

const toMetadata = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const toPaymentDto = (row: PaymentRow): PaymentDto => ({
  id: row.id,
  tenantId: row.tenantId,
  orderId: row.orderId,
  provider: row.provider,
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

const orderStatusForPayment = (status: PaymentStatus): "paid" | "pending" | "cancelled" | undefined => {
  switch (status) {
    case "captured":
      return "paid";
    case "failed":
    case "cancelled":
      return "pending";
    case "pending":
    case "authorized":
    case "refunded":
      return undefined;
  }
};

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PaymentPrismaClient) {}

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
    const existing = await this.prisma.paymentWebhookEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        provider: input.webhook.provider,
        providerEventId: input.webhook.providerEventId,
        deletedAt: null
      }
    });

    if (existing !== null) {
      return toWebhookDto(existing);
    }

    const event = await this.prisma.paymentWebhookEvent.create({
      data: {
        tenantId: input.tenantId,
        provider: input.webhook.provider,
        providerEventId: input.webhook.providerEventId,
        eventType: input.webhook.eventType,
        payload: input.webhook.payload
      }
    });

    return toWebhookDto(event);
  }

  async applyWebhook(input: ApplyPaymentWebhookInput): Promise<PaymentDto | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.paymentWebhookEvent.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          providerEventId: input.webhook.providerEventId,
          deletedAt: null
        }
      });

      if (event === null || event.status === "processed") {
        return undefined;
      }

      const payment = await tx.payment.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.webhook.provider,
          providerPaymentId: input.webhook.providerPaymentId,
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

      const nextOrderStatus = orderStatusForPayment(input.webhook.status);

      if (nextOrderStatus !== undefined) {
        await tx.order.updateMany({
          where: {
            id: payment.orderId,
            tenantId: input.tenantId
          },
          data: {
            status: nextOrderStatus,
            ...(nextOrderStatus === "paid" ? { placedAt: now } : {})
          }
        });
      }

      await tx.paymentWebhookEvent.update({
        where: {
          id: event.id
        },
        data: {
          status: "processed",
          processedAt: now
        }
      });

      return toPaymentDto(updated);
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
