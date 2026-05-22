import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiEnv } from "../../env.js";
import {
  invalidWebhookSignatureError,
  paymentProviderNotConfiguredError,
  paymentProviderRequestFailedError
} from "./payment.errors.js";
import type {
  PaymentInitiationDto,
  OnlinePaymentProvider,
  PaymentStatus,
  VerifiedPaymentWebhook
} from "./payment.types.js";

export interface CreateProviderPaymentInput {
  readonly amount: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly tenantId: string;
}

export interface PaymentProviderClient {
  createPayment(input: CreateProviderPaymentInput): Promise<Omit<PaymentInitiationDto, "payment">>;
  verifyWebhook(input: {
    readonly rawBody: string;
    readonly signature: string | undefined;
    readonly tenantId: string;
  }): VerifiedPaymentWebhook;
}

const toMinorUnits = (amount: string): number => Math.round(Number(amount) * 100);

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown provider error";

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const getObjectRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const getString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const stripeStatusMap = new Map<string, PaymentStatus>([
  ["payment_intent.requires_payment_method", "failed"],
  ["payment_intent.processing", "pending"],
  ["payment_intent.requires_capture", "authorized"],
  ["payment_intent.succeeded", "captured"],
  ["payment_intent.payment_failed", "failed"],
  ["charge.refunded", "refunded"]
]);

const razorpayStatusMap = new Map<string, PaymentStatus>([
  ["payment.authorized", "authorized"],
  ["payment.captured", "captured"],
  ["payment.failed", "failed"],
  ["refund.processed", "refunded"]
]);

class StripePaymentProviderClient implements PaymentProviderClient {
  constructor(private readonly env: ApiEnv) {}

  async createPayment(input: CreateProviderPaymentInput): Promise<Omit<PaymentInitiationDto, "payment">> {
    if (this.env.STRIPE_SECRET_KEY === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    let payload: Record<string, unknown>;

    try {
      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": input.idempotencyKey
        },
        body: new URLSearchParams({
          amount: String(toMinorUnits(input.amount)),
          currency: input.currency.toLowerCase(),
          "metadata[paymentId]": input.paymentId,
          "metadata[orderId]": input.orderId,
          "metadata[tenantId]": input.tenantId,
          automatic_payment_methods: "true"
        })
      });

      payload = getObjectRecord(await response.json());

      if (!response.ok) {
        throw paymentProviderRequestFailedError(
          "Stripe",
          getString(getObjectRecord(payload["error"]), "message") ?? "Stripe API rejected payment initiation"
        );
      }
    } catch (error) {
      if ("code" in Object(error)) {
        throw error;
      }

      console.error("PAYMENT PROVIDER ERROR:", error);
      throw paymentProviderRequestFailedError("Stripe", toErrorMessage(error));
    }

    const clientSecret = getString(payload, "client_secret");
    const providerOrderId = getString(payload, "id");

    return {
      ...(clientSecret === undefined ? {} : { providerClientSecret: clientSecret }),
      ...(providerOrderId === undefined ? {} : { providerOrderId })
    };
  }

  verifyWebhook(input: { readonly rawBody: string; readonly signature: string | undefined }): VerifiedPaymentWebhook {
    if (this.env.STRIPE_WEBHOOK_SECRET === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    const signature = input.signature;
    const timestamp = signature?.split(",").find((part) => part.startsWith("t="))?.slice(2);
    const expectedSignature = signature?.split(",").find((part) => part.startsWith("v1="))?.slice(3);

    if (timestamp === undefined || expectedSignature === undefined) {
      throw invalidWebhookSignatureError();
    }

    const ageSeconds = Math.abs(Date.now() / 1_000 - Number(timestamp));

    if (!Number.isFinite(ageSeconds) || ageSeconds > this.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS) {
      throw invalidWebhookSignatureError();
    }

    const signedPayload = `${timestamp}.${input.rawBody}`;
    const computed = createHmac("sha256", this.env.STRIPE_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest("hex");

    if (!safeEqual(computed, expectedSignature)) {
      throw invalidWebhookSignatureError();
    }

    const event = getObjectRecord(JSON.parse(input.rawBody));
    const data = getObjectRecord(getObjectRecord(event["data"])["object"]);
    const eventType = getString(event, "type") ?? "unknown";
    const providerPaymentId = getString(data, "id");
    const providerTransactionId = getString(data, "latest_charge");

    return {
      provider: "stripe",
      providerEventId: getString(event, "id") ?? `${eventType}:unknown`,
      eventType,
      ...(providerPaymentId === undefined ? {} : { providerPaymentId }),
      ...(providerTransactionId === undefined ? {} : { providerTransactionId }),
      status: stripeStatusMap.get(eventType) ?? "pending",
      payload: event
    };
  }
}

class RazorpayPaymentProviderClient implements PaymentProviderClient {
  constructor(private readonly env: ApiEnv) {}

  async createPayment(input: CreateProviderPaymentInput): Promise<Omit<PaymentInitiationDto, "payment">> {
    if (this.env.RAZORPAY_KEY_ID === undefined || this.env.RAZORPAY_KEY_SECRET === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    const amount = toMinorUnits(input.amount);
    const currency = "INR";

    console.info("RAZORPAY CONFIG", {
      key: this.env.RAZORPAY_KEY_ID !== undefined,
      secret: this.env.RAZORPAY_KEY_SECRET !== undefined
    });
    console.info("RAZORPAY ORDER PAYLOAD", {
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount,
      currency,
      sourceCurrency: input.currency
    });

    const credentials = Buffer.from(`${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    let payload: Record<string, unknown>;

    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          authorization: `Basic ${credentials}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency,
          receipt: input.orderId,
          notes: {
            paymentId: input.paymentId,
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey,
            sourceCurrency: input.currency
          }
        })
      });

      payload = getObjectRecord(await response.json());

      if (!response.ok) {
        throw paymentProviderRequestFailedError(
          "Razorpay",
          getString(getObjectRecord(payload["error"]), "description") ?? "Razorpay API rejected order creation"
        );
      }
    } catch (error) {
      if ("code" in Object(error)) {
        throw error;
      }

      console.error("PAYMENT PROVIDER ERROR:", error);
      if (error instanceof Error && error.stack !== undefined) {
        console.error(error.stack);
      }
      throw paymentProviderRequestFailedError("Razorpay", toErrorMessage(error));
    }

    const providerOrderId = getString(payload, "id");

    return {
      ...(providerOrderId === undefined ? {} : { providerOrderId }),
      publishableKey: this.env.RAZORPAY_KEY_ID
    };
  }

  verifyWebhook(input: { readonly rawBody: string; readonly signature: string | undefined }): VerifiedPaymentWebhook {
    if (this.env.RAZORPAY_WEBHOOK_SECRET === undefined || input.signature === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    const computed = createHmac("sha256", this.env.RAZORPAY_WEBHOOK_SECRET)
      .update(input.rawBody)
      .digest("hex");

    if (!safeEqual(computed, input.signature)) {
      throw invalidWebhookSignatureError();
    }

    const event = getObjectRecord(JSON.parse(input.rawBody));
    const eventType = getString(event, "event") ?? "unknown";
    const paymentEntity = getObjectRecord(getObjectRecord(getObjectRecord(event["payload"])["payment"])["entity"]);
    const providerPaymentId = getString(paymentEntity, "order_id");
    const providerTransactionId = getString(paymentEntity, "id");

    return {
      provider: "razorpay",
      providerEventId: getString(event, "id") ?? `${eventType}:${providerPaymentId ?? "unknown"}`,
      eventType,
      ...(providerPaymentId === undefined ? {} : { providerPaymentId }),
      ...(providerTransactionId === undefined ? {} : { providerTransactionId }),
      status: razorpayStatusMap.get(eventType) ?? "pending",
      payload: event
    };
  }
}

export const createPaymentProviderClient = (
  provider: OnlinePaymentProvider,
  env: ApiEnv
): PaymentProviderClient =>
  provider === "stripe"
    ? new StripePaymentProviderClient(env)
    : new RazorpayPaymentProviderClient(env);
