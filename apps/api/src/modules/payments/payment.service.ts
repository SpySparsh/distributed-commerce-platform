import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { ApiEnv } from "../../env.js";
import { paymentNotFoundError } from "./payment.errors.js";
import type {
  PaymentRepository
} from "./payment.repository.js";
import type {
  InitiatePaymentBody,
  PaymentRetryBody
} from "./payment.schemas.js";
import type {
  PaymentDto,
  PaymentInitiationDto,
  OnlinePaymentProvider,
  VerifiedPaymentWebhook
} from "./payment.types.js";
import { createPaymentProviderClient } from "./payment.provider.js";

export interface PaymentService {
  initiatePayment(input: InitiatePaymentBody): Promise<PaymentInitiationDto>;
  getPayment(tenantId: string, paymentId: string): Promise<PaymentDto | undefined>;
  handleWebhook(input: {
    readonly provider: OnlinePaymentProvider;
    readonly rawBody: string;
    readonly signature: string | undefined;
  }): Promise<{ readonly processed: boolean; readonly payment?: PaymentDto }>;
  schedulePaymentRetry(input: PaymentRetryBody): Promise<string>;
}

export const createPaymentService = (
  repository: PaymentRepository,
  queues: QueueProducer,
  env: ApiEnv
): PaymentService => ({
  async initiatePayment(input) {
    const provider = input.provider ?? env.PAYMENT_PROVIDER;
    const payment = await repository.createPayment({
      tenantId: input.tenantId,
      orderId: input.orderId,
      provider,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey
    });
    const providerClient = createPaymentProviderClient(provider, env);
    const providerResult = await providerClient.createPayment({
      tenantId: input.tenantId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      paymentId: payment.id
    });
    const updatedPayment =
      providerResult.providerOrderId === undefined
        ? payment
        : await repository.updateProviderPayment({
            tenantId: input.tenantId,
            paymentId: payment.id,
            providerPaymentId: providerResult.providerOrderId
          });

    return {
      payment: updatedPayment,
      ...(providerResult.providerClientSecret === undefined
        ? {}
        : { providerClientSecret: providerResult.providerClientSecret }),
      ...(providerResult.providerCheckoutUrl === undefined ? {} : { providerCheckoutUrl: providerResult.providerCheckoutUrl }),
      ...(providerResult.providerOrderId === undefined ? {} : { providerOrderId: providerResult.providerOrderId }),
      ...(providerResult.publishableKey === undefined ? {} : { publishableKey: providerResult.publishableKey })
    };
  },

  getPayment(tenantId, paymentId) {
    return repository.findPaymentById(tenantId, paymentId);
  },

  async handleWebhook(input) {
    const providerClient = createPaymentProviderClient(input.provider, env);
    const webhook: VerifiedPaymentWebhook = providerClient.verifyWebhook({
      rawBody: input.rawBody,
      signature: input.signature,
      tenantId: ""
    });
    const payment = await repository.findPaymentByWebhookReference({
      provider: input.provider,
      ...(webhook.providerPaymentId === undefined ? {} : { providerPaymentId: webhook.providerPaymentId }),
      ...(webhook.paymentId === undefined ? {} : { paymentId: webhook.paymentId }),
      ...(webhook.orderId === undefined ? {} : { orderId: webhook.orderId }),
      ...(webhook.tenantId === undefined ? {} : { tenantId: webhook.tenantId })
    });

    if (payment === undefined) {
      console.warn("WEBHOOK PAYMENT NOT FOUND", {
        provider: input.provider,
        eventType: webhook.eventType,
        providerEventId: webhook.providerEventId,
        providerPaymentId: webhook.providerPaymentId,
        paymentId: webhook.paymentId,
        orderId: webhook.orderId
      });
      return {
        processed: false
      };
    }

    const event = await repository.recordWebhook({
      tenantId: payment.tenantId,
      webhook
    });

    if (event.status === "processed") {
      return {
        processed: false
      };
    }

    const applied = await repository.applyWebhook({
      tenantId: payment.tenantId,
      webhook
    });

    if (applied === undefined) {
      return { processed: false };
    }

    console.info("PAYMENT UPDATED", {
      paymentId: applied.payment.id,
      orderId: applied.payment.orderId,
      status: applied.payment.status,
      providerPaymentId: applied.payment.providerPaymentId,
      providerTransactionId: applied.payment.providerTransactionId
    });

    if (applied.order !== undefined) {
      console.info("ORDER UPDATED", {
        orderId: applied.order.id,
        orderNumber: applied.order.orderNumber,
        beforeStatus: applied.order.beforeStatus,
        afterStatus: applied.order.afterStatus
      });
    }

    if (applied.inventoryConsumed) {
      console.info("INVENTORY CONSUMED", {
        orderId: applied.payment.orderId,
        paymentId: applied.payment.id
      });
    }

    if (applied.inventoryReleased) {
      console.info("INVENTORY RELEASED", {
        orderId: applied.payment.orderId,
        paymentId: applied.payment.id
      });
    }

    if (applied.payment.status === "captured" && applied.order !== undefined) {
      await queues.enqueue({
        name: jobNames.sendEmail,
        metadata: {
          tenantId: applied.payment.tenantId,
          idempotencyKey: `order-confirmation:${applied.order.id}:${applied.payment.id}`,
          createdAt: new Date().toISOString()
        },
        data: {
          to: applied.order.email,
          template: "order-confirmation",
          variables: {
            orderId: applied.order.id,
            orderNumber: applied.order.orderNumber,
            paymentStatus: "paid",
            totalAmount: applied.order.totalAmount,
            currency: applied.order.currency,
            items: applied.order.items
          }
        }
      });

      console.info("EMAIL SENT", {
        orderId: applied.order.id,
        paymentId: applied.payment.id,
        to: applied.order.email,
        template: "order-confirmation"
      });
    }

    return {
      processed: true,
      payment: applied.payment
    };
  },

  async schedulePaymentRetry(input) {
    const payment = await repository.findPaymentById(input.tenantId, input.paymentId);
    if (payment === undefined) {
      throw paymentNotFoundError();
    }

    const retryAt = new Date(Date.now() + 5 * 60 * 1_000);
    await repository.markPaymentRetryScheduled(input.tenantId, input.paymentId, retryAt);

    return queues.enqueue({
      name: jobNames.retryPayment,
      metadata: {
        tenantId: input.tenantId,
        idempotencyKey: `payment-retry:${input.paymentId}:${retryAt.toISOString()}`,
        createdAt: new Date().toISOString()
      },
      data: {
        paymentId: input.paymentId,
        orderId: payment.orderId,
        attempt: 1
      }
    });
  }
});
