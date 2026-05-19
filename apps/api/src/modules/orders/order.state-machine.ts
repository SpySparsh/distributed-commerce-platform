import { invalidOrderTransitionError } from "./order.errors.js";
import type { OrderEventType, OrderStatus } from "./order.types.js";

const transitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: []
} satisfies Record<OrderStatus, readonly OrderStatus[]>;

const eventByStatus = {
  pending: "created",
  confirmed: "confirmed",
  paid: "paid",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  refunded: "refunded"
} satisfies Record<OrderStatus, OrderEventType>;

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
  const allowed: readonly OrderStatus[] = transitions[from];

  if (!allowed.includes(to)) {
    throw invalidOrderTransitionError(from, to);
  }
};

export const toOrderEventType = (status: OrderStatus): OrderEventType => eventByStatus[status];
