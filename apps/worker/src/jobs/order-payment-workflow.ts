import type { PrismaClient } from "@ecommerce/database";
import type { PaymentCompletedEvent } from "@ecommerce/events";

const paidAt = (event: PaymentCompletedEvent): Date => new Date(event.metadata.occurredAt);

export const handlePaymentCompletedOrderWorkflow = async (
  prisma: PrismaClient,
  event: PaymentCompletedEvent
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: event.payload.paymentId,
        tenantId: event.metadata.tenantId,
        orderId: event.payload.orderId,
        status: "captured",
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (payment === null) {
      throw new Error("Captured payment not found for PaymentCompleted event");
    }

    const order = await tx.order.findFirst({
      where: {
        id: event.payload.orderId,
        tenantId: event.metadata.tenantId,
        deletedAt: null
      },
      include: {
        items: {
          where: {
            deletedAt: null
          }
        }
      }
    });

    if (order === null) {
      throw new Error("Order not found for PaymentCompleted event");
    }

    if (order.status === "paid") {
      return;
    }

    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new Error(`Order cannot be marked paid from status ${order.status}`);
    }

    const now = paidAt(event);
    const transitioned = await tx.order.updateMany({
      where: {
        id: order.id,
        tenantId: event.metadata.tenantId,
        status: order.status,
        version: order.version
      },
      data: {
        status: "paid",
        placedAt: now,
        version: {
          increment: 1
        }
      }
    });

    if (transitioned.count !== 1) {
      throw new Error("Concurrent order payment transition detected");
    }

    for (const item of order.items) {
      const activeReservations = await tx.inventoryReservation.findMany({
        where: {
          tenantId: event.metadata.tenantId,
          orderItemId: item.id,
          status: "active",
          deletedAt: null
        },
        select: {
          id: true,
          inventoryItemId: true,
          variantId: true,
          quantity: true
        }
      });
      const reservedQuantity = activeReservations.reduce(
        (total, reservation) => total + reservation.quantity,
        0
      );

      if (reservedQuantity !== item.quantity) {
        throw new Error("Order item is not backed by active linked reservations");
      }

      const reservationGroups = new Map<string, number>();

      for (const reservation of activeReservations) {
        if (reservation.variantId !== item.variantId) {
          throw new Error("Reservation variant does not match order item variant");
        }

        reservationGroups.set(
          reservation.inventoryItemId,
          (reservationGroups.get(reservation.inventoryItemId) ?? 0) + reservation.quantity
        );
      }

      for (const [inventoryItemId, quantity] of reservationGroups) {
        const consumed = await tx.$executeRaw`
          UPDATE "InventoryItem"
          SET "quantity" = "quantity" - ${quantity},
              "reserved" = "reserved" - ${quantity},
              "version" = "version" + 1,
              "updatedAt" = NOW()
          WHERE "id" = ${inventoryItemId}::uuid
            AND "tenantId" = ${event.metadata.tenantId}::uuid
            AND "variantId" = ${item.variantId}::uuid
            AND "quantity" >= ${quantity}
            AND "reserved" >= ${quantity}
        `;

        if (consumed !== 1) {
          throw new Error("Order inventory was not reserved before payment completion");
        }
      }

      const consumedReservations = await tx.inventoryReservation.updateMany({
        where: {
          id: {
            in: activeReservations.map((reservation) => reservation.id)
          },
          tenantId: event.metadata.tenantId,
          orderItemId: item.id,
          status: "active"
        },
        data: {
          status: "consumed",
          consumedAt: now
        }
      });

      if (consumedReservations.count !== activeReservations.length) {
        throw new Error("Concurrent reservation consumption detected");
      }
    }

    await tx.orderEvent.create({
      data: {
        tenantId: event.metadata.tenantId,
        orderId: order.id,
        type: "paid",
        beforeStatus: order.status,
        afterStatus: "paid",
        metadata: {
          paymentId: event.payload.paymentId,
          provider: event.payload.provider,
          providerPaymentId: event.payload.providerPaymentId ?? null,
          eventId: event.metadata.eventId
        }
      }
    });

    await tx.orderEvent.create({
      data: {
        tenantId: event.metadata.tenantId,
        orderId: order.id,
        type: "inventory_consumed",
        metadata: {
          paymentId: event.payload.paymentId,
          itemCount: order.items.length,
          eventId: event.metadata.eventId
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: event.metadata.tenantId,
        action: "order",
        entityType: "Order",
        entityId: order.id,
        before: {
          status: order.status
        },
        after: {
          status: "paid"
        },
        metadata: {
          source: "PaymentCompleted",
          paymentId: event.payload.paymentId,
          eventId: event.metadata.eventId
        }
      }
    });
  });
};
