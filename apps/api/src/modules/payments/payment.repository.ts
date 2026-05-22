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

export interface PaymentWebhookLookupInput {
  readonly provider: PaymentProvider;
  readonly providerPaymentId?: string;
  readonly paymentId?: string;
  readonly orderId?: string;
  readonly tenantId?: string;
}

export interface OrderConfirmationItemDto {
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly totalAmount: string;
}

export interface OrderConfirmationDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly email: string;
  readonly beforeStatus: string;
  readonly afterStatus: string;
  readonly totalAmount: string;
  readonly currency: string;
  readonly items: readonly OrderConfirmationItemDto[];
}

export interface PaymentWebhookApplicationResult {
  readonly payment: PaymentDto;
  readonly order?: OrderConfirmationDto;
  readonly inventoryConsumed: boolean;
  readonly inventoryReleased: boolean;
}

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<PaymentDto>;
  findPaymentById(tenantId: string, paymentId: string): Promise<PaymentDto | undefined>;
  findPaymentByProviderPaymentId(
    provider: PaymentProvider,
    providerPaymentId: string
  ): Promise<PaymentDto | undefined>;
  findPaymentByWebhookReference(input: PaymentWebhookLookupInput): Promise<PaymentDto | undefined>;
  updateProviderPayment(input: UpdateProviderPaymentInput): Promise<PaymentDto>;
  recordWebhook(input: RecordWebhookInput): Promise<PaymentWebhookEventDto>;
  applyWebhook(input: ApplyPaymentWebhookInput): Promise<PaymentWebhookApplicationResult | undefined>;
  markPaymentRetryScheduled(tenantId: string, paymentId: string, nextRetryAt: Date): Promise<void>;
}
