export class CheckoutError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const checkoutCartNotFoundError = (): CheckoutError =>
  new CheckoutError("Cart not found for checkout", "CHECKOUT_CART_NOT_FOUND", 404);

export const checkoutCartEmptyError = (): CheckoutError =>
  new CheckoutError("Cart cannot be checked out without items", "CHECKOUT_CART_EMPTY", 409);

export const checkoutCartMismatchError = (): CheckoutError =>
  new CheckoutError("Cart snapshot does not match durable cart state", "CHECKOUT_CART_MISMATCH", 409);

export const checkoutInventoryUnavailableError = (): CheckoutError =>
  new CheckoutError("Inventory is no longer available for checkout", "CHECKOUT_INVENTORY_UNAVAILABLE", 409);

export const checkoutPaymentConflictError = (): CheckoutError =>
  new CheckoutError("Checkout payment state conflicts with this request", "CHECKOUT_PAYMENT_CONFLICT", 409);
