export type PaymentProvider = "stripe" | "razorpay";
export type PaymentStatus = "pending" | "authorized" | "captured" | "failed" | "refunded" | "cancelled";
export type PaymentWebhookStatus = "received" | "processed" | "ignored" | "failed";

export interface PaymentDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly provider: PaymentProvider;
  readonly status: PaymentStatus;
  readonly amount: string;
  readonly currency: string;
  readonly providerPaymentId?: string;
  readonly providerTransactionId?: string;
  readonly idempotencyKey: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly retryCount: number;
  readonly nextRetryAt?: string;
  readonly metadata: Record<string, unknown>;
  readonly authorizedAt?: string;
  readonly capturedAt?: string;
  readonly failedAt?: string;
  readonly refundedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaymentInitiationDto {
  readonly payment: PaymentDto;
  readonly providerClientSecret?: string;
  readonly providerOrderId?: string;
  readonly publishableKey?: string;
}

export interface VerifiedPaymentWebhook {
  readonly provider: PaymentProvider;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly providerPaymentId?: string;
  readonly providerTransactionId?: string;
  readonly status: PaymentStatus;
  readonly payload: Record<string, unknown>;
}
