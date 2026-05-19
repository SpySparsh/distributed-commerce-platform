import type { CreateOrderBody } from "./order.schemas.js";
import type { OrderDto, OrderEventDto, OrderStatus } from "./order.types.js";

export interface OrderActor {
  readonly userId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface TransitionOrderInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly nextStatus: OrderStatus;
  readonly actor: OrderActor;
  readonly paymentId?: string;
  readonly reason?: string;
}

export interface OrderRepository {
  createOrder(input: CreateOrderBody, actor: OrderActor): Promise<OrderDto>;
  findOrder(tenantId: string, orderId: string): Promise<OrderDto | undefined>;
  transitionOrder(input: TransitionOrderInput): Promise<OrderDto>;
  listOrderEvents(tenantId: string, orderId: string): Promise<readonly OrderEventDto[]>;
  markInvoiceRequested(tenantId: string, orderId: string, actor: OrderActor): Promise<OrderDto>;
}
