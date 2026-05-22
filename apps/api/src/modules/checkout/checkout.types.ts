import type { CartDto } from "../carts/cart.types.js";
import type { OrderDto } from "../orders/order.types.js";
import type { PaymentInitiationDto } from "../payments/payment.types.js";

export interface CheckoutResultDto {
  readonly cart?: CartDto;
  readonly order: OrderDto;
  readonly payment: PaymentInitiationDto;
}
