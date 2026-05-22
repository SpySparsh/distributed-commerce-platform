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
  ["checkout.session.completed", "captured"],
  ["checkout.session.async_payment_succeeded", "captured"],
  ["checkout.session.async_payment_failed", "failed"],
  ["payment_intent.requires_payment_method", "failed"],
  ["payment_intent.processing", "pending"],
  ["payment_intent.requires_capture", "authorized"],
  ["payment_intent.succeeded", "captured"],
  ["payment_intent.payment_failed", "failed"],
  ["charge.refunded", "refunded"]
]);

class StripePaymentProviderClient implements PaymentProviderClient {
  constructor(private readonly env: ApiEnv) {}

  async createPayment(input: CreateProviderPaymentInput): Promise<Omit<PaymentInitiationDto, "payment">> {
    if (this.env.STRIPE_SECRET_KEY === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    let payload: Record<string, unknown>;

    try {
      const successUrl = `${this.env.FRONTEND_URL.replace(/\/$/, "")}/order/${input.orderId}?payment=stripe-success`;
      const cancelUrl = `${this.env.FRONTEND_URL.replace(/\/$/, "")}/checkout?payment=stripe-cancelled`;
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": input.idempotencyKey
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": input.currency.toLowerCase(),
          "line_items[0][price_data][unit_amount]": String(toMinorUnits(input.amount)),
          "line_items[0][price_data][product_data][name]": `Order ${input.orderId}`,
          "metadata[paymentId]": input.paymentId,
          "metadata[orderId]": input.orderId,
          "metadata[tenantId]": input.tenantId,
          "payment_intent_data[metadata][paymentId]": input.paymentId,
          "payment_intent_data[metadata][orderId]": input.orderId,
          "payment_intent_data[metadata][tenantId]": input.tenantId,
          "automatic_payment_methods[enabled]": "true"
        })
      });

      payload = getObjectRecord(await response.json());

      console.info("STRIPE CHECKOUT SESSION RESPONSE", {
        paymentId: input.paymentId,
        orderId: input.orderId,
        ok: response.ok,
        status: response.status,
        providerOrderId: getString(payload, "id"),
        hasCheckoutUrl: getString(payload, "url") !== undefined,
        errorMessage: getString(getObjectRecord(payload["error"]), "message")
      });

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
      if (error instanceof Error && error.stack !== undefined) {
        console.error(error.stack);
      }
      throw paymentProviderRequestFailedError("Stripe", toErrorMessage(error));
    }

    const providerOrderId = getString(payload, "id");
    const providerCheckoutUrl = getString(payload, "url");

    return {
      ...(providerCheckoutUrl === undefined ? {} : { providerCheckoutUrl }),
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
    const providerTransactionId =
      getString(data, "payment_intent") ??
      getString(data, "latest_charge");

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

export const createPaymentProviderClient = (
  _provider: OnlinePaymentProvider,
  env: ApiEnv
): PaymentProviderClient => new StripePaymentProviderClient(env);
