import { Prisma, type PrismaClient } from "@ecommerce/database";
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
}

const toMetadata = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const toJsonObject = (value: Record<string, unknown>): Prisma.InputJsonObject =>
  value as Prisma.InputJsonObject;

const toSupportedPaymentProvider = (provider: string): PaymentProvider => {
  if (provider === "stripe" || provider === "razorpay") {
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
          ...(input.webhook.providerPaymentId === undefined
            ? {}
            : { providerPaymentId: input.webhook.providerPaymentId }),
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
