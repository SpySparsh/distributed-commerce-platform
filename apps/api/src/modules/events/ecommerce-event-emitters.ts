import {
  createCartExpiredEvent,
  createInventoryReservedEvent,
  createOrderPlacedEvent,
  createPaymentCompletedEvent,
  createProductUpdatedEvent,
  type DomainEventContext
} from "@ecommerce/events";
import type { DomainEventPublisher } from "./domain-event-publisher.js";

export interface EcommerceEventEmitters {
  orderPlaced(input: {
    readonly context: DomainEventContext;
    readonly orderId: string;
    readonly orderNumber: string;
    readonly userId?: string;
    readonly cartId?: string;
    readonly totalAmount: string;
    readonly currency: string;
    readonly itemCount: number;
  }): Promise<string>;
  paymentCompleted(input: {
    readonly context: DomainEventContext;
    readonly paymentId: string;
    readonly orderId: string;
    readonly provider: "stripe" | "cod" | "manual";
    readonly amount: string;
    readonly currency: string;
    readonly providerPaymentId?: string;
  }): Promise<string>;
  inventoryReserved(input: {
    readonly context: DomainEventContext;
    readonly reservationId: string;
    readonly variantId: string;
    readonly quantity: number;
    readonly expiresAt: string;
    readonly cartItemId?: string;
  }): Promise<string>;
  cartExpired(input: {
    readonly context: DomainEventContext;
    readonly cartId: string;
    readonly userId?: string;
    readonly guestId?: string;
    readonly expiredAt: string;
  }): Promise<string>;
  productUpdated(input: {
    readonly context: DomainEventContext;
    readonly productId: string;
    readonly slug: string;
    readonly changedFields: readonly string[];
    readonly shouldReindex?: boolean;
  }): Promise<string>;
}

export const createEcommerceEventEmitters = (
  publisher: DomainEventPublisher
): EcommerceEventEmitters => ({
  orderPlaced(input) {
    return publisher.publish(createOrderPlacedEvent(input.context, {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      ...(input.userId === undefined ? {} : { userId: input.userId }),
      ...(input.cartId === undefined ? {} : { cartId: input.cartId }),
      totalAmount: input.totalAmount,
      currency: input.currency,
      itemCount: input.itemCount
    }));
  },

  paymentCompleted(input) {
    return publisher.publish(createPaymentCompletedEvent(input.context, {
      paymentId: input.paymentId,
      orderId: input.orderId,
      provider: input.provider,
      amount: input.amount,
      currency: input.currency,
      ...(input.providerPaymentId === undefined ? {} : { providerPaymentId: input.providerPaymentId })
    }));
  },

  inventoryReserved(input) {
    return publisher.publish(createInventoryReservedEvent(input.context, {
      reservationId: input.reservationId,
      variantId: input.variantId,
      quantity: input.quantity,
      expiresAt: input.expiresAt,
      ...(input.cartItemId === undefined ? {} : { cartItemId: input.cartItemId })
    }));
  },

  cartExpired(input) {
    return publisher.publish(createCartExpiredEvent(input.context, {
      cartId: input.cartId,
      ...(input.userId === undefined ? {} : { userId: input.userId }),
      ...(input.guestId === undefined ? {} : { guestId: input.guestId }),
      expiredAt: input.expiredAt
    }));
  },

  productUpdated(input) {
    return publisher.publish(createProductUpdatedEvent(input.context, {
      productId: input.productId,
      slug: input.slug,
      changedFields: [...input.changedFields],
      shouldReindex: input.shouldReindex ?? true
    }));
  }
});
