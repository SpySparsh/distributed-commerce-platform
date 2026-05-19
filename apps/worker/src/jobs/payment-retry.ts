import type { PaymentRetryJob, QueueProducer } from "@ecommerce/queue";
import { jobNames } from "@ecommerce/queue";
import type { PrismaClient } from "@ecommerce/database";
import type { JobHandlerContext } from "./handlers.js";

const enqueueRecoveryEmail = async (
  queues: QueueProducer,
  input: {
    readonly tenantId: string;
    readonly paymentId: string;
    readonly orderId: string;
    readonly email: string;
    readonly attempt: number;
  }
): Promise<void> => {
  await queues.enqueue({
    name: jobNames.sendEmail,
    metadata: {
      tenantId: input.tenantId,
      idempotencyKey: `payment-recovery-email:${input.paymentId}:${input.attempt}`,
      createdAt: new Date().toISOString()
    },
    data: {
      to: input.email,
      template: "payment-retry-required",
      variables: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        attempt: input.attempt
      }
    }
  });
};

const scheduleNextRetry = async (
  prisma: PrismaClient,
  job: PaymentRetryJob
): Promise<{ readonly email: string; readonly retryCount: number } | undefined> => {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: job.data.paymentId,
        tenantId: job.metadata.tenantId,
        orderId: job.data.orderId,
        status: "failed",
        deletedAt: null
      },
      include: {
        order: {
          select: {
            email: true
          }
        }
      }
    });

    if (payment === null) {
      return undefined;
    }

    const now = new Date();

    if (payment.nextRetryAt !== null && payment.nextRetryAt > now) {
      return undefined;
    }

    const retryCount = payment.retryCount + 1;
    const backoffMinutes = Math.min(60, 5 * 2 ** Math.max(retryCount - 1, 0));
    const updated = await tx.payment.updateMany({
      where: {
        id: payment.id,
        tenantId: job.metadata.tenantId,
        status: "failed",
        retryCount: payment.retryCount
      },
      data: {
        retryCount,
        nextRetryAt: new Date(now.getTime() + backoffMinutes * 60_000)
      }
    });

    if (updated.count !== 1) {
      return undefined;
    }

    return {
      email: payment.order.email,
      retryCount
    };
  });
};

export const handlePaymentRetryJob = async (
  job: PaymentRetryJob,
  context: JobHandlerContext
): Promise<void> => {
  const result = await scheduleNextRetry(context.prisma, job);

  if (result === undefined) {
    context.logger.info(
      {
        tenantId: job.metadata.tenantId,
        paymentId: job.data.paymentId,
        orderId: job.data.orderId,
        idempotencyKey: job.metadata.idempotencyKey
      },
      "Payment retry skipped"
    );
    return;
  }

  await enqueueRecoveryEmail(context.queues, {
    tenantId: job.metadata.tenantId,
    paymentId: job.data.paymentId,
    orderId: job.data.orderId,
    email: result.email,
    attempt: result.retryCount
  });

  context.logger.warn(
    {
      tenantId: job.metadata.tenantId,
      paymentId: job.data.paymentId,
      orderId: job.data.orderId,
      retryCount: result.retryCount,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Payment retry recovery email enqueued"
  );
};
