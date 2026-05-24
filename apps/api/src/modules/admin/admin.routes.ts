import { jobNames } from "@ecommerce/queue";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requireRole } from "../auth/auth.middleware.js";

const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const adminProductBodySchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().max(5_000).optional(),
  price: moneySchema,
  category: z.string().trim().min(1).max(160),
  countInStock: z.coerce.number().int().nonnegative().max(1_000_000),
  image: z.url().optional(),
  sku: z.string().trim().min(1).max(128).optional(),
  currency: z.string().length(3).default("USD").transform((value) => value.toUpperCase())
});

const idParamsSchema = z.object({
  id: z.uuid()
});

const userParamsSchema = z.object({
  userId: z.uuid()
});

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const toAdminPaymentStatus = (status: string | undefined): string => {
  switch (status) {
    case "captured":
      return "paid";
    case "failed":
    case "refunded":
    case "cancelled":
    case "authorized":
    case "pending":
      return status;
    default:
      return "pending";
  }
};

const toPublicOrderStatus = (status: string): string =>
  status === "fulfilled" ? "delivered" : status;

const toMinorUnits = (amount: string): number => Math.round(Number(amount) * 100);

const toMoney = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

const toAdminProduct = (product: {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  category: { name: string; slug: string } | null;
  createdAt: Date;
  updatedAt: Date;
  variants: readonly {
    id: string;
    sku: string;
    price: { toString(): string };
    currency: string;
    inventoryItem: { quantity: number; reserved: number; safetyStock: number } | null;
  }[];
  images: readonly { url: string; isPrimary: boolean }[];
}) => {
  const variant = product.variants[0];
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const inventory = variant?.inventoryItem;

  return {
    _id: product.id,
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.description ?? "",
    status: product.status,
    category: product.category?.name ?? "",
    categorySlug: product.category?.slug,
    price: variant?.price.toString() ?? "0.00",
    currency: variant?.currency ?? "USD",
    variantId: variant?.id,
    image: image?.url ?? "",
    countInStock: inventory === null || inventory === undefined
      ? 0
      : Math.max(inventory.quantity - inventory.reserved - inventory.safetyStock, 0),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
};

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminGuard = [
    requireRole("admin"),
    withRateLimit({ keyPrefix: "admin", maxRequests: 180 })
  ];

  const productInclude = {
    category: {
      select: {
        name: true,
        slug: true
      }
    },
    variants: {
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" as const },
      include: {
        inventoryItem: true
      }
    },
    images: {
      where: { deletedAt: null },
      orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }]
    }
  };

  const enqueueOrderEmail = async (
    input: {
      readonly tenantId: string;
      readonly requestId: string;
      readonly to: string;
      readonly template: "order-confirmation" | "payment-success" | "order-delivered";
      readonly idempotencyKey: string;
      readonly variables: Record<string, unknown>;
    }
  ): Promise<void> => {
    try {
      await app.queues.enqueue({
        name: jobNames.sendEmail,
        metadata: {
          tenantId: input.tenantId,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
          createdAt: new Date().toISOString()
        },
        data: {
          to: input.to,
          template: input.template,
          variables: input.variables
        }
      });

      app.log.info(
        {
          tenantId: input.tenantId,
          to: input.to,
          template: input.template,
          idempotencyKey: input.idempotencyKey
        },
        "EMAIL SENT"
      );
    } catch (error) {
      app.log.error(
        {
          err: error,
          tenantId: input.tenantId,
          to: input.to,
          template: input.template,
          idempotencyKey: input.idempotencyKey
        },
        "Failed to enqueue lifecycle email"
      );
    }
  };

  app.get("/dashboard/summary", { preHandler: adminGuard }, async (request) => {
    const tenantId = getAuthenticatedTenantId(request);
    const [userCount, productCount, activeCartCount, totalOrders, paidPayments, pendingOrders, deliveredOrders, ordersByStatus, paymentsByStatus] =
      await Promise.all([
        app.prisma.user.count({ where: { tenantId, deletedAt: null } }),
        app.prisma.product.count({ where: { tenantId, deletedAt: null } }),
        app.prisma.cart.count({ where: { tenantId, status: "active", deletedAt: null } }),
        app.prisma.order.count({ where: { tenantId, deletedAt: null } }),
        app.prisma.payment.findMany({
          where: { tenantId, deletedAt: null, status: "captured" },
          select: {
            orderId: true,
            amount: true
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
        }),
        app.prisma.order.count({ where: { tenantId, deletedAt: null, status: "pending" } }),
        app.prisma.order.count({ where: { tenantId, deletedAt: null, status: "fulfilled" } }),
        app.prisma.order.groupBy({
          by: ["status"],
          where: { tenantId, deletedAt: null },
          _count: { _all: true }
        }),
        app.prisma.payment.groupBy({
          by: ["status"],
          where: { tenantId, deletedAt: null },
          _count: { _all: true }
        })
      ]);
    const paidPaymentsByOrderId = new Map<string, string>();

    for (const payment of paidPayments) {
      if (!paidPaymentsByOrderId.has(payment.orderId)) {
        paidPaymentsByOrderId.set(payment.orderId, payment.amount.toString());
      }
    }

    const revenue = toMoney([...paidPaymentsByOrderId.values()].reduce(
      (total, amount) => total + toMinorUnits(amount),
      0
    ));

    return {
      ok: true,
      data: {
        totalOrders,
        revenue,
        paidOrders: paidPaymentsByOrderId.size,
        pendingOrders,
        deliveredOrders,
        userCount,
        productCount,
        activeCartCount,
        ordersByStatus: ordersByStatus.map((item) => ({
          status: toPublicOrderStatus(item.status),
          count: item._count._all
        })),
        paymentsByStatus: paymentsByStatus.map((item) => ({
          status: toAdminPaymentStatus(item.status),
          count: item._count._all
        }))
      }
    };
  });

  app.get("/top-products", { preHandler: adminGuard }, async (request) => {
    const tenantId = getAuthenticatedTenantId(request);
    const rows = await app.prisma.orderItem.groupBy({
      by: ["productId"],
      where: { tenantId, deletedAt: null },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10
    });
    const productIds = rows.map((row) => row.productId);
    const products =
      productIds.length === 0
        ? []
        : await app.prisma.product.findMany({
            where: { tenantId, id: { in: productIds } },
            include: productInclude
          });

    return {
      ok: true,
      data: rows.map((row) => {
        const product = products.find((item) => item.id === row.productId);
        return {
          ...(product === undefined ? { _id: row.productId, name: row.productId, price: "0.00" } : toAdminProduct(product)),
          totalSold: row._sum.quantity ?? 0
        };
      })
    };
  });

  app.get("/users", { preHandler: adminGuard }, async (request) => {
    const tenantId = getAuthenticatedTenantId(request);
    const users = await app.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: "desc" }
    });

    return {
      ok: true,
      data: users.map((user) => ({
        _id: user.id,
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        email: user.email,
        status: user.status,
        role: user.userRoles.some((item) => item.role.key === "admin") ? "admin" : "customer",
        roles: user.userRoles.map((item) => item.role.key),
        createdAt: user.createdAt.toISOString()
      }))
    };
  });

  app.put(
    "/users/:userId/promote",
    { preHandler: [...adminGuard, validateRequest({ params: userParamsSchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = userParamsSchema.parse(request.params);
      const user = await app.prisma.user.findFirst({
        where: { tenantId, id: params.userId, deletedAt: null },
        select: { id: true }
      });

      if (user === null) {
        await reply.status(404).send({ ok: false, error: { code: "USER_NOT_FOUND", message: "User not found", correlationId: request.correlationId } });
        return;
      }

      const role = await app.prisma.role.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key: "admin" } } });
      await app.prisma.userRole.upsert({
        where: { tenantId_userId_roleId: { tenantId, userId: params.userId, roleId: role.id } },
        update: {},
        create: { tenantId, userId: params.userId, roleId: role.id }
      });
      return { ok: true, data: { promoted: true } };
    }
  );

  app.delete(
    "/users/:userId",
    { preHandler: [...adminGuard, validateRequest({ params: userParamsSchema })] },
    async (request) => {
      const tenantId = getAuthenticatedTenantId(request);
      const actorId = getAuthenticatedUserId(request);
      const params = userParamsSchema.parse(request.params);

      if (params.userId === actorId) {
        return { ok: false, error: { code: "SELF_DELETE_BLOCKED", message: "Admins cannot delete themselves", correlationId: request.correlationId } };
      }

      await app.prisma.user.updateMany({
        where: { tenantId, id: params.userId },
        data: { status: "deleted", deletedAt: new Date() }
      });
      return { ok: true, data: { deleted: true } };
    }
  );

  app.get("/orders", { preHandler: adminGuard }, async (request) => {
    const tenantId = getAuthenticatedTenantId(request);
    const orders = await app.prisma.order.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        user: true,
        items: { where: { deletedAt: null } },
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return {
      ok: true,
      data: orders.map((order) => {
        const latestPayment = order.payments[0];

        return {
          _id: order.id,
          id: order.id,
          orderNumber: order.orderNumber,
          user: order.user === null ? undefined : { name: [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.email },
          createdAt: order.createdAt.toISOString(),
          totalAmount: order.totalAmount.toString(),
          currency: order.currency,
          status: toPublicOrderStatus(order.status),
          orderStatus: toPublicOrderStatus(order.status),
          paymentStatus: toAdminPaymentStatus(latestPayment?.status),
          isPaid: latestPayment?.status === "captured" || ["paid", "fulfilled"].includes(order.status),
          isDelivered: order.status === "fulfilled",
          paymentMethod: latestPayment?.provider ?? "stripe",
          itemCount: order.items.length
        };
      })
    };
  });

  app.post(
    "/orders/:id/mark-paid",
    { preHandler: [...adminGuard, validateRequest({ params: idParamsSchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = idParamsSchema.parse(request.params);
      const now = new Date();

      const result = await app.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { tenantId, id: params.id, deletedAt: null },
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" }
            },
            payments: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" }
            }
          }
        });

        if (order === null) {
          return undefined;
        }

        const existingPayment = order.payments[0];
        const payment = existingPayment === undefined
          ? await tx.payment.create({
              data: {
                tenantId,
                orderId: order.id,
                provider: "manual",
                status: "captured",
                amount: order.totalAmount,
                currency: order.currency,
                idempotencyKey: `admin-paid:${order.id}`,
                paidAt: now,
                capturedAt: now,
                metadata: {
                  source: "admin_mark_paid"
                }
              }
            })
          : await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "captured",
                paidAt: existingPayment.paidAt ?? now,
                capturedAt: existingPayment.capturedAt ?? now,
                failureCode: null,
                failureMessage: null,
                nextRetryAt: null,
                metadata: {
                  ...(typeof existingPayment.metadata === "object" && existingPayment.metadata !== null
                    ? existingPayment.metadata as Record<string, unknown>
                    : {}),
                  adminMarkedPaidAt: now.toISOString()
                }
              }
            });

        let inventoryConsumed = false;

        if (!["paid", "fulfilled"].includes(order.status)) {
          for (const item of order.items) {
            const reservations = await tx.inventoryReservation.findMany({
              where: {
                tenantId,
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

            if (reservations.length > 0) {
              const reservationGroups = new Map<string, number>();

              for (const reservation of reservations) {
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
                    AND "tenantId" = ${tenantId}::uuid
                    AND "quantity" >= ${quantity}
                    AND "reserved" >= ${quantity}
                `;

                if (consumed !== 1) {
                  throw Object.assign(new Error("Reserved inventory is required before marking the order paid"), {
                    code: "ORDER_INVENTORY_NOT_RESERVED",
                    statusCode: 409
                  });
                }
              }

              const reservationIds = reservations.map((reservation) => reservation.id);

              if (reservationIds.length > 0) {
                await tx.inventoryReservation.updateMany({
                  where: {
                    id: { in: reservationIds },
                    tenantId,
                    status: "active"
                  },
                  data: {
                    status: "consumed",
                    consumedAt: now
                  }
                });
                inventoryConsumed = true;
              }
            }
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "paid",
              placedAt: order.placedAt ?? now,
              version: { increment: 1 }
            }
          });

          await tx.orderEvent.create({
            data: {
              tenantId,
              orderId: order.id,
              type: "paid",
              beforeStatus: order.status,
              afterStatus: "paid",
              actorUserId: getAuthenticatedUserId(request),
              requestId: request.id,
              metadata: {
                paymentId: payment.id,
                source: "admin_mark_paid"
              }
            }
          });

          if (inventoryConsumed) {
            await tx.orderEvent.create({
              data: {
                tenantId,
                orderId: order.id,
                type: "inventory_consumed",
                actorUserId: getAuthenticatedUserId(request),
                requestId: request.id,
                metadata: {
                  paymentId: payment.id,
                  itemCount: order.items.length,
                  source: "admin_mark_paid"
                }
              }
            });
          }
        }

        const updatedOrder = await tx.order.findFirstOrThrow({
          where: { tenantId, id: order.id },
          include: {
            items: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
            payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
          }
        });

        return { order: updatedOrder, payment };
      });

      if (result === undefined) {
        await reply.status(404).send({ ok: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found", correlationId: request.correlationId } });
        return;
      }

      request.log.info(
        {
          orderId: result.order.id,
          paymentId: result.payment.id,
          amount: result.payment.amount.toString(),
          provider: result.payment.provider
        },
        "PAYMENT MARKED PAID"
      );
      request.log.info(
        {
          orderId: result.order.id,
          paymentId: result.payment.id,
          revenueAmount: result.payment.amount.toString()
        },
        "REVENUE UPDATED"
      );

      await enqueueOrderEmail({
        tenantId,
        requestId: request.id,
        to: result.order.email,
        template: "payment-success",
        idempotencyKey: `payment-success:${result.order.id}:${result.payment.id}`,
        variables: {
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
          paymentAmount: result.payment.amount.toString(),
          paymentProvider: result.payment.provider,
          paidAt: (result.payment.paidAt ?? result.payment.capturedAt ?? now).toISOString()
        }
      });

      return {
        ok: true,
        data: {
          order: {
            id: result.order.id,
            _id: result.order.id,
            orderNumber: result.order.orderNumber,
            status: toPublicOrderStatus(result.order.status),
            paymentStatus: toAdminPaymentStatus(result.payment.status)
          }
        }
      };
    }
  );

  app.post(
    "/orders/:id/mark-delivered",
    { preHandler: [...adminGuard, validateRequest({ params: idParamsSchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = idParamsSchema.parse(request.params);
      const now = new Date();

      const order = await app.prisma.$transaction(async (tx) => {
        const existing = await tx.order.findFirst({
          where: { tenantId, id: params.id, deletedAt: null },
          include: {
            items: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
            payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
          }
        });

        if (existing === null) {
          return undefined;
        }

        if (existing.status !== "fulfilled") {
          await tx.order.update({
            where: { id: existing.id },
            data: {
              status: "fulfilled",
              deliveredAt: now,
              version: { increment: 1 }
            }
          });

          await tx.orderEvent.create({
            data: {
              tenantId,
              orderId: existing.id,
              type: "fulfilled",
              beforeStatus: existing.status,
              afterStatus: "fulfilled",
              actorUserId: getAuthenticatedUserId(request),
              requestId: request.id,
              metadata: {
                deliveredAt: now.toISOString(),
                source: "admin_mark_delivered"
              }
            }
          });
        }

        return tx.order.findFirstOrThrow({
          where: { tenantId, id: existing.id },
          include: {
            items: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
            payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
          }
        });
      });

      if (order === undefined) {
        await reply.status(404).send({ ok: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found", correlationId: request.correlationId } });
        return;
      }

      request.log.info(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          deliveredAt: order.deliveredAt?.toISOString()
        },
        "ORDER DELIVERED"
      );

      await enqueueOrderEmail({
        tenantId,
        requestId: request.id,
        to: order.email,
        template: "order-delivered",
        idempotencyKey: `order-delivered:${order.id}:${order.deliveredAt?.toISOString() ?? now.toISOString()}`,
        variables: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          products: order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            totalAmount: item.totalAmount.toString(),
            reviewUrl: `${app.config.FRONTEND_URL.replace(/\/$/, "")}/product/${item.productId}?reviewOrderId=${order.id}&reviewOrderItemId=${item.id}`
          })),
          reviewLinks: order.items.map((item) => ({
            productId: item.productId,
            orderItemId: item.id,
            name: item.name,
            url: `${app.config.FRONTEND_URL.replace(/\/$/, "")}/product/${item.productId}?reviewOrderId=${order.id}&reviewOrderItemId=${item.id}`
          })),
          deliveredAt: order.deliveredAt?.toISOString() ?? now.toISOString(),
          message: "Thank you for shopping with us."
        }
      });

      return {
        ok: true,
        data: {
          order: {
            id: order.id,
            _id: order.id,
            orderNumber: order.orderNumber,
            status: toPublicOrderStatus(order.status),
            paymentStatus: toAdminPaymentStatus(order.payments[0]?.status),
            deliveredAt: order.deliveredAt?.toISOString()
          }
        }
      };
    }
  );

  app.get("/products", { preHandler: adminGuard }, async (request) => {
    const tenantId = getAuthenticatedTenantId(request);
    const products = await app.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return { ok: true, data: { products: products.map(toAdminProduct) } };
  });

  app.get(
    "/products/:id",
    { preHandler: [...adminGuard, validateRequest({ params: idParamsSchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = idParamsSchema.parse(request.params);
      const product = await app.prisma.product.findFirst({
        where: { tenantId, id: params.id, deletedAt: null },
        include: productInclude
      });

      if (product === null) {
        await reply.status(404).send({ ok: false, error: { code: "PRODUCT_NOT_FOUND", message: "Product not found", correlationId: request.correlationId } });
        return;
      }

      return { ok: true, data: { product: toAdminProduct(product) } };
    }
  );

  app.post(
    "/products",
    { preHandler: [...adminGuard, validateRequest({ body: adminProductBodySchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const body = adminProductBodySchema.parse(request.body);
      const categorySlug = slugify(body.category);
      const productSlug = slugify(body.name);
      const sku = body.sku ?? `${productSlug.toUpperCase().replace(/-/g, "-")}-${Date.now()}`;

      const product = await app.prisma.$transaction(async (tx) => {
        const category = await tx.category.upsert({
          where: { tenantId_slug: { tenantId, slug: categorySlug } },
          update: { name: body.category, deletedAt: null },
          create: { tenantId, slug: categorySlug, name: body.category }
        });
        const created = await tx.product.create({
          data: {
            tenantId,
            categoryId: category.id,
            sku,
            slug: `${productSlug}-${Date.now()}`,
            name: body.name,
            description: body.description ?? null,
            status: "active",
            variants: {
              create: {
                tenantId,
                sku,
                name: "Default",
                price: body.price,
                currency: body.currency,
                status: "active",
                inventoryItem: { create: { tenantId, quantity: body.countInStock, reserved: 0, safetyStock: 0 } }
              }
            },
            ...(body.image === undefined ? {} : {
              images: { create: { tenantId, url: body.image, altText: body.name, isPrimary: true, position: 0 } }
            })
          }
        });
        return tx.product.findFirstOrThrow({ where: { tenantId, id: created.id }, include: productInclude });
      });

      try {
        await app.queues.enqueue({
          name: jobNames.indexProductSearchDocument,
          metadata: { tenantId, idempotencyKey: `search:index:${product.id}:${Date.now()}`, createdAt: new Date().toISOString(), requestId: request.id },
          data: { productId: product.id }
        });
      } catch (error) {
        request.log.error({ err: error, productId: product.id }, "Failed to enqueue product search indexing job");
      }

      await reply.status(201).send({ ok: true, data: { product: toAdminProduct(product) } });
    }
  );

  app.put(
    "/products/:id",
    { preHandler: [...adminGuard, validateRequest({ params: idParamsSchema, body: adminProductBodySchema })] },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = idParamsSchema.parse(request.params);
      const body = adminProductBodySchema.parse(request.body);
      const categorySlug = slugify(body.category);
      const productSlug = slugify(body.name);

      const product = await app.prisma.$transaction(async (tx) => {
        const existingProduct = await tx.product.findFirst({
          where: { tenantId, id: params.id, deletedAt: null },
          select: { id: true }
        });

        if (existingProduct === null) {
          return null;
        }

        const category = await tx.category.upsert({
          where: { tenantId_slug: { tenantId, slug: categorySlug } },
          update: { name: body.category, deletedAt: null },
          create: { tenantId, slug: categorySlug, name: body.category }
        });
        await tx.product.update({
          where: { id: params.id },
          data: {
            categoryId: category.id,
            slug: productSlug,
            name: body.name,
            description: body.description ?? null,
            status: "active"
          }
        });
        const updated = await tx.product.findFirstOrThrow({ where: { tenantId, id: params.id }, include: productInclude });
        const variant = updated.variants[0];
        if (variant !== undefined) {
          await tx.productVariant.update({ where: { id: variant.id }, data: { price: body.price, currency: body.currency } });
          await tx.inventoryItem.upsert({
            where: { variantId: variant.id },
            update: { quantity: body.countInStock, deletedAt: null },
            create: { tenantId, variantId: variant.id, quantity: body.countInStock, reserved: 0, safetyStock: 0 }
          });
        }
        if (body.image !== undefined && body.image.length > 0) {
          await tx.productImage.updateMany({ where: { tenantId, productId: params.id }, data: { isPrimary: false } });
          await tx.productImage.create({ data: { tenantId, productId: params.id, url: body.image, altText: body.name, isPrimary: true, position: 0 } });
        }
        return tx.product.findFirstOrThrow({ where: { tenantId, id: params.id }, include: productInclude });
      });

      if (product === null) {
        await reply.status(404).send({ ok: false, error: { code: "PRODUCT_NOT_FOUND", message: "Product not found", correlationId: request.correlationId } });
        return;
      }

      try {
        await app.queues.enqueue({
          name: jobNames.indexProductSearchDocument,
          metadata: { tenantId, idempotencyKey: `search:index:${product.id}:${Date.now()}`, createdAt: new Date().toISOString(), requestId: request.id },
          data: { productId: product.id }
        });
      } catch (error) {
        request.log.error({ err: error, productId: product.id }, "Failed to enqueue product search indexing job");
      }

      return { ok: true, data: { product: toAdminProduct(product) } };
    }
  );

  app.delete(
    "/products/:id",
    { preHandler: [...adminGuard, validateRequest({ params: idParamsSchema })] },
    async (request) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = idParamsSchema.parse(request.params);
      await app.prisma.product.updateMany({ where: { tenantId, id: params.id }, data: { status: "archived", deletedAt: new Date() } });
      try {
        await app.queues.enqueue({
          name: jobNames.deleteProductSearchDocument,
          metadata: { tenantId, idempotencyKey: `search:delete:${params.id}:${Date.now()}`, createdAt: new Date().toISOString(), requestId: request.id },
          data: { productId: params.id }
        });
      } catch (error) {
        request.log.error({ err: error, productId: params.id }, "Failed to enqueue product search deletion job");
      }
      return { ok: true, data: { deleted: true } };
    }
  );
};
