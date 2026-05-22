export type OrderStatus = "pending" | "confirmed" | "paid" | "fulfilled" | "cancelled" | "refunded";

export type OrderEventType =
  | "created"
  | "confirmed"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "payment_synced"
  | "inventory_consumed"
  | "invoice_requested";

export interface OrderItemDto {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly totalAmount: string;
  readonly currency: string;
}

export interface OrderDto {
  readonly id: string;
  readonly tenantId: string;
  readonly userId?: string;
  readonly cartId?: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly subtotalAmount: string;
  readonly taxAmount: string;
  readonly shippingAmount: string;
  readonly discountAmount: string;
  readonly totalAmount: string;
  readonly currency: string;
  readonly email: string;
  readonly shippingAddress: Record<string, unknown>;
  readonly billingAddress?: Record<string, unknown>;
  readonly invoiceNumber?: string;
  readonly invoiceUrl?: string;
  readonly placedAt?: string;
  readonly deliveredAt?: string;
  readonly invoicedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly OrderItemDto[];
}

export interface OrderEventDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly type: OrderEventType;
  readonly beforeStatus?: OrderStatus;
  readonly afterStatus?: OrderStatus;
  readonly actorUserId?: string;
  readonly requestId?: string;
  readonly reason?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}
