export class OrderError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const orderNotFoundError = (): OrderError =>
  new OrderError("ORDER_NOT_FOUND", "Order not found", 404);

export const invalidOrderTransitionError = (from: string, to: string): OrderError =>
  new OrderError("INVALID_ORDER_TRANSITION", `Order cannot transition from ${from} to ${to}`, 409);

export const orderPaymentRequiredError = (): OrderError =>
  new OrderError("ORDER_PAYMENT_REQUIRED", "Payment synchronization is required for this transition", 409);

export const orderInventoryNotReservedError = (): OrderError =>
  new OrderError("ORDER_INVENTORY_NOT_RESERVED", "Reserved inventory is required before marking the order paid", 409);
