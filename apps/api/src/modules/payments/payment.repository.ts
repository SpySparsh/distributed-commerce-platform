import type {
  PaymentDto,
  PaymentProvider,
  PaymentStatus,
  PaymentWebhookStatus,
  VerifiedPaymentWebhook
} from "./payment.types.js";

export interface CreatePaymentInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly provider: PaymentProvider;
  readonly amount: string;
  readonly currency: string;
  readonly idempotencyKey: string;
}

export interface UpdateProviderPaymentInput {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly providerPaymentId?: string;
  readonly providerTransactionId?: string;
}

export interface ApplyPaymentWebhookInput {
  readonly tenantId: string;
  readonly webhook: VerifiedPaymentWebhook;
}

export interface RecordWebhookInput {
  readonly tenantId: string;
  readonly webhook: VerifiedPaymentWebhook;
}

export interface PaymentWebhookEventDto {
  readonly id: string;
  readonly providerEventId: string;
  readonly status: PaymentWebhookStatus;
  readonly processedAt?: string;
}

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<PaymentDto>;
  findPaymentById(tenantId: string, paymentId: string): Promise<PaymentDto | undefined>;
  updateProviderPayment(input: UpdateProviderPaymentInput): Promise<PaymentDto>;
  recordWebhook(input: RecordWebhookInput): Promise<PaymentWebhookEventDto>;
  applyWebhook(input: ApplyPaymentWebhookInput): Promise<PaymentDto | undefined>;
  markPaymentRetryScheduled(tenantId: string, paymentId: string, nextRetryAt: Date): Promise<void>;
}

export class UnconfiguredPaymentRepository implements PaymentRepository {
  async createPayment(): Promise<PaymentDto> {
    throw new Error("Payment repository is not configured");
  }

  async findPaymentById(): Promise<PaymentDto | undefined> {
    return undefined;
  }

  async updateProviderPayment(): Promise<PaymentDto> {
    throw new Error("Payment repository is not configured");
  }

  async recordWebhook(): Promise<PaymentWebhookEventDto> {
    throw new Error("Payment repository is not configured");
  }

  async applyWebhook(): Promise<PaymentDto | undefined> {
    return undefined;
  }

  async markPaymentRetryScheduled(): Promise<void> {}
}
