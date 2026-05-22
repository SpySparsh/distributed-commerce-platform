import { jobNames, type QueueProducer } from "@ecommerce/queue";
import type { CreateOrderBody, TransitionOrderBody } from "./order.schemas.js";
import type { OrderActor, OrderRepository } from "./order.repository.js";
import type { OrderDto, OrderEventDto } from "./order.types.js";

export interface OrderService {
  createOrder(input: CreateOrderBody, actor: OrderActor): Promise<OrderDto>;
  getOrder(tenantId: string, orderId: string): Promise<OrderDto | undefined>;
  listUserOrders(tenantId: string, userId: string): Promise<readonly OrderDto[]>;
  transitionOrder(orderId: string, input: TransitionOrderBody, actor: OrderActor): Promise<OrderDto>;
  listEvents(tenantId: string, orderId: string): Promise<readonly OrderEventDto[]>;
  requestInvoice(tenantId: string, orderId: string, actor: OrderActor): Promise<{ readonly order: OrderDto; readonly jobId: string }>;
}

export const createOrderService = (
  repository: OrderRepository,
  queues: QueueProducer
): OrderService => ({
  createOrder(input, actor) {
    return repository.createOrder(input, actor);
  },

  getOrder(tenantId, orderId) {
    return repository.findOrder(tenantId, orderId);
  },

  listUserOrders(tenantId, userId) {
    return repository.listUserOrders(tenantId, userId);
  },

  transitionOrder(orderId, input, actor) {
    return repository.transitionOrder({
      tenantId: input.tenantId,
      orderId,
      nextStatus: input.nextStatus,
      actor,
      ...(input.paymentId === undefined ? {} : { paymentId: input.paymentId }),
      ...(input.reason === undefined ? {} : { reason: input.reason })
    });
  },

  listEvents(tenantId, orderId) {
    return repository.listOrderEvents(tenantId, orderId);
  },

  async requestInvoice(tenantId, orderId, actor) {
    const order = await repository.markInvoiceRequested(tenantId, orderId, actor);
    const jobId = await queues.enqueue({
      name: jobNames.generateInvoice,
      metadata: {
        tenantId,
        idempotencyKey: `invoice:${orderId}`,
        createdAt: new Date().toISOString(),
        ...(actor.requestId === undefined ? {} : { requestId: actor.requestId })
      },
      data: {
        orderId,
        ...(actor.userId === undefined ? {} : { userId: actor.userId })
      }
    });

    return {
      order,
      jobId
    };
  }
});
