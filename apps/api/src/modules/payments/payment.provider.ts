import Stripe from "stripe";
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
const stripeIntegrationVersion = "stripe@22.1.1";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown provider error";

const getObjectRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const getString = (record: Record<string, unknown> | Stripe.Metadata | null | undefined, key: string): string | undefined => {
  if (record === null || record === undefined) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const stripeStatusMap = new Map<string, PaymentStatus>([
  ["checkout.session.completed", "captured"],
  ["checkout.session.async_payment_succeeded", "captured"],
  ["checkout.session.expired", "failed"],
  ["checkout.session.async_payment_failed", "failed"],
  ["payment_intent.requires_payment_method", "failed"],
  ["payment_intent.processing", "pending"],
  ["payment_intent.requires_capture", "authorized"],
  ["payment_intent.succeeded", "captured"],
  ["payment_intent.payment_failed", "failed"],
  ["charge.refunded", "refunded"]
]);

const getPaymentIntentId = (
  value: string | Stripe.PaymentIntent | null
): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  return value?.id;
};

const getChargeId = (
  value: string | Stripe.Charge | null
): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  return value?.id;
};

class StripePaymentProviderClient implements PaymentProviderClient {
  private readonly stripe: Stripe | undefined;

  constructor(private readonly env: ApiEnv) {
    this.stripe = env.STRIPE_SECRET_KEY === undefined
      ? undefined
      : new Stripe(env.STRIPE_SECRET_KEY);
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<Omit<PaymentInitiationDto, "payment">> {
    if (this.stripe === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    try {
      const successUrl = `${this.env.FRONTEND_URL.replace(/\/$/, "")}/order/${input.orderId}?payment=stripe-success`;
      const cancelUrl = `${this.env.FRONTEND_URL.replace(/\/$/, "")}/checkout?payment=stripe-cancelled`;
      const stripePayload = {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: toMinorUnits(input.amount),
              product_data: {
                name: `Order ${input.orderId}`
              }
            }
          }
        ],
        metadata: {
          paymentId: input.paymentId,
          orderId: input.orderId,
          tenantId: input.tenantId
        },
        payment_intent_data: {
          metadata: {
            paymentId: input.paymentId,
            orderId: input.orderId,
            tenantId: input.tenantId
          }
        }
      } satisfies Stripe.Checkout.SessionCreateParams;

      console.info("STRIPE CONFIG", {
        stripeConfigured: this.env.STRIPE_SECRET_KEY !== undefined,
        stripeVersion: stripeIntegrationVersion
      });
      console.info("STRIPE CHECKOUT SESSION PAYLOAD", {
        stripePayload
      });

      const session = await this.stripe.checkout.sessions.create(stripePayload, {
        idempotencyKey: input.idempotencyKey
      });

      console.info("STRIPE CHECKOUT SESSION RESPONSE", {
        paymentId: input.paymentId,
        orderId: input.orderId,
        providerOrderId: session.id,
        hasCheckoutUrl: session.url !== null,
        status: session.status
      });

      return {
        ...(session.url === null ? {} : { providerCheckoutUrl: session.url }),
        providerOrderId: session.id
      };
    } catch (error) {
      console.error("PAYMENT PROVIDER ERROR:", error);
      if (error instanceof Error && error.stack !== undefined) {
        console.error(error.stack);
      }
      throw paymentProviderRequestFailedError("Stripe", toErrorMessage(error));
    }
  }

  verifyWebhook(input: { readonly rawBody: string; readonly signature: string | undefined }): VerifiedPaymentWebhook {
    if (this.stripe === undefined || this.env.STRIPE_WEBHOOK_SECRET === undefined) {
      throw paymentProviderNotConfiguredError();
    }

    if (input.signature === undefined) {
      throw invalidWebhookSignatureError();
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        this.env.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      throw invalidWebhookSignatureError();
    }

    const rawPayload = getObjectRecord(JSON.parse(input.rawBody));
    const eventType = event.type;
    const status = stripeStatusMap.get(eventType) ?? "pending";

    console.info("WEBHOOK RECEIVED", {
      provider: "stripe",
      eventType,
      providerEventId: event.id
    });

    if (eventType.startsWith("checkout.session.")) {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      const providerTransactionId = getPaymentIntentId(session.payment_intent);
      const tenantId = getString(metadata, "tenantId");
      const orderId = getString(metadata, "orderId");
      const paymentId = getString(metadata, "paymentId");

      return {
        provider: "stripe",
        providerEventId: event.id,
        eventType,
        ...(tenantId === undefined ? {} : { tenantId }),
        ...(orderId === undefined ? {} : { orderId }),
        ...(paymentId === undefined ? {} : { paymentId }),
        providerPaymentId: session.id,
        ...(providerTransactionId === undefined ? {} : { providerTransactionId }),
        status,
        payload: rawPayload
      };
    }

    if (eventType.startsWith("payment_intent.")) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;
      const tenantId = getString(metadata, "tenantId");
      const orderId = getString(metadata, "orderId");
      const paymentId = getString(metadata, "paymentId");

      return {
        provider: "stripe",
        providerEventId: event.id,
        eventType,
        ...(tenantId === undefined ? {} : { tenantId }),
        ...(orderId === undefined ? {} : { orderId }),
        ...(paymentId === undefined ? {} : { paymentId }),
        providerPaymentId: paymentIntent.id,
        providerTransactionId: getChargeId(paymentIntent.latest_charge) ?? paymentIntent.id,
        status,
        payload: rawPayload
      };
    }

    return {
      provider: "stripe",
      providerEventId: event.id,
      eventType,
      status,
      payload: rawPayload
    };
  }
}

export const createPaymentProviderClient = (
  _provider: OnlinePaymentProvider,
  env: ApiEnv
): PaymentProviderClient => new StripePaymentProviderClient(env);
