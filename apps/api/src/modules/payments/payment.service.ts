import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { ApiEnv } from "../../env.js";
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
  PaymentProvider,
  VerifiedPaymentWebhook
} from "./payment.types.js";
import { createPaymentProviderClient } from "./payment.provider.js";

export interface PaymentService {
  initiatePayment(input: InitiatePaymentBody): Promise<PaymentInitiationDto>;
  getPayment(tenantId: string, paymentId: string): Promise<PaymentDto | undefined>;
  handleWebhook(input: {
    readonly tenantId: string;
    readonly provider: PaymentProvider;
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
      tenantId: input.tenantId
    });
    const event = await repository.recordWebhook({
      tenantId: input.tenantId,
      webhook
    });

    if (event.status === "processed") {
      return {
        processed: false
      };
    }

    const payment = await repository.applyWebhook({
      tenantId: input.tenantId,
      webhook
    });

    return payment === undefined
      ? { processed: false }
      : {
          processed: true,
          payment
        };
  },

  async schedulePaymentRetry(input) {
    const payment = await repository.findPaymentById(input.tenantId, input.paymentId);
    const orderId = payment?.orderId ?? input.paymentId;
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
        orderId,
        attempt: 1
      }
    });
  }
});
