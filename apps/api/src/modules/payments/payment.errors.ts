export class PaymentError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const paymentProviderNotConfiguredError = (): PaymentError =>
  new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", "Payment provider is not configured", 503);

export const paymentProviderRequestFailedError = (provider: string, message: string): PaymentError =>
  new PaymentError("PAYMENT_PROVIDER_REQUEST_FAILED", `${provider} payment initialization failed: ${message}`, 502);

export const paymentNotFoundError = (): PaymentError =>
  new PaymentError("PAYMENT_NOT_FOUND", "Payment not found", 404);

export const invalidWebhookSignatureError = (): PaymentError =>
  new PaymentError("INVALID_WEBHOOK_SIGNATURE", "Invalid payment webhook signature", 401);

export const duplicateWebhookEventError = (): PaymentError =>
  new PaymentError("DUPLICATE_WEBHOOK_EVENT", "Payment webhook event has already been processed", 200);
