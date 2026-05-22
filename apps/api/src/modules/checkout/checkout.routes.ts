import { deleteCart, getCart, type RedisCacheClient } from "@ecommerce/cache";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import type { OrderActor } from "../orders/order.repository.js";
import type { CheckoutRepository } from "./checkout.repository.js";
import { startBuyNowCheckoutBodySchema, startCheckoutBodySchema } from "./checkout.schemas.js";

const createRedisCacheClient = (app: Parameters<FastifyPluginAsync>[0]): RedisCacheClient => ({
  get: (key) => app.redis.get(key),
  set: (key, value, mode, ttl, condition) =>
    mode === undefined || ttl === undefined
      ? app.redis.set(key, value)
      : condition === undefined
        ? app.redis.call("set", key, value, mode, String(ttl))
        : app.redis.call("set", key, value, mode, String(ttl), condition),
  del: (...keys) => app.redis.del(...keys),
  expire: (key, seconds) => app.redis.expire(key, seconds),
  scan: (cursor, matchLabel, pattern, countLabel, count) =>
    app.redis.scan(cursor, matchLabel, pattern, countLabel, count),
  eval: (script, keyCount, ...args) => app.redis.eval(script, keyCount, ...args),
  hgetall: (key) => app.redis.hgetall(key),
  hset: (key, values) => app.redis.hset(key, values),
  hdel: (key, ...fields) => app.redis.hdel(key, ...fields)
});

const getActor = (request: FastifyRequest): OrderActor => ({
  ...(request.user?.id === undefined ? {} : { userId: request.user.id }),
  requestId: request.id,
  ipAddress: request.ip,
  ...(request.headers["user-agent"] === undefined
    ? {}
    : { userAgent: String(request.headers["user-agent"]) })
});

export interface CheckoutRouteOptions {
  readonly repository: CheckoutRepository;
}

export const checkoutRoutes: FastifyPluginAsync<CheckoutRouteOptions> = async (app, options) => {
  const redis = createRedisCacheClient(app);
  const enqueueOrderCreatedEmail = async (
    request: FastifyRequest,
    checkout: Awaited<ReturnType<CheckoutRepository["startCheckout"]>>
  ): Promise<void> => {
    try {
      await app.queues.enqueue({
        name: "email.send",
        metadata: {
          tenantId: checkout.order.tenantId,
          requestId: request.id,
          idempotencyKey: `order-created:${checkout.order.id}:${checkout.payment.payment.id}`,
          createdAt: new Date().toISOString()
        },
        data: {
          to: checkout.order.email,
          template: "order-confirmation",
          variables: {
            customerName: String(checkout.order.shippingAddress["name"] ?? checkout.order.email),
            orderId: checkout.order.id,
            orderNumber: checkout.order.orderNumber,
            products: checkout.order.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              totalAmount: item.totalAmount
            })),
            total: checkout.order.totalAmount,
            currency: checkout.order.currency,
            paymentMethod: checkout.payment.payment.provider,
            orderStatus: checkout.order.status
          }
        }
      });
      request.log.info(
        {
          orderId: checkout.order.id,
          paymentId: checkout.payment.payment.id,
          to: checkout.order.email,
          template: "order-confirmation"
        },
        "EMAIL SENT"
      );
    } catch (error) {
      request.log.error(
        {
          err: error,
          orderId: checkout.order.id,
          paymentId: checkout.payment.payment.id
        },
        "Failed to enqueue order confirmation email"
      );
    }
  };

  app.post(
    "/start",
    {
      preHandler: [
        requirePermission(permissions.checkoutWrite),
        withRateLimit({ keyPrefix: "checkout:start", maxRequests: 30 }),
        validateRequest({ body: startCheckoutBodySchema })
      ]
    },
    async (request, reply) => {
      const body = startCheckoutBodySchema.parse(request.body);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const cachedCart = await getCart(redis, tenantId, body.cartId);

      request.log.info(
        {
          cartId: body.cartId,
          tenantId,
          userId,
          paymentMethod: body.provider ?? app.config.PAYMENT_PROVIDER,
          stripeConfigured: app.config.STRIPE_SECRET_KEY !== undefined,
          cachedCartFound: cachedCart !== undefined,
          cachedCartUserId: cachedCart?.userId,
          cachedCartGuestId: cachedCart?.guestId,
          cachedCartItemCount: cachedCart?.items.length
        },
        "Starting checkout"
      );

      let checkout;

      try {
        request.log.info("STEP 1: validate cart");
        request.log.info("STEP 2: reserve inventory");
        request.log.info("STEP 3: create order");
        request.log.info("STEP 4: create payment");
        request.log.info(
          {
            paymentMethod: body.provider ?? app.config.PAYMENT_PROVIDER,
            stripeConfigured: app.config.STRIPE_SECRET_KEY !== undefined
          },
          "STEP 5: initialize payment provider"
        );
        checkout = await options.repository.startCheckout({
        ...body,
        tenantId,
        userId
        }, cachedCart, getActor(request));
        request.log.info("STEP 6: finalize response");
      } catch (error) {
        request.log.error({ err: error, cartId: body.cartId, tenantId, userId }, "FAILED CHECKOUT STEP");
        throw error;
      }

      if (checkout.cart?.status === "converted") {
        try {
          await deleteCart(redis, tenantId, body.cartId);
        } catch (error) {
          request.log.error(
            {
              err: error,
              cartId: body.cartId,
              tenantId,
              userId
            },
            "Checkout succeeded but cart cache invalidation failed"
          );
        }
      }

      await enqueueOrderCreatedEmail(request, checkout);

      await reply.status(201).send({
        ok: true,
        data: checkout
      });
    }
  );

  app.post(
    "/buy-now",
    {
      preHandler: [
        requirePermission(permissions.checkoutWrite),
        withRateLimit({ keyPrefix: "checkout:buy-now", maxRequests: 30 }),
        validateRequest({ body: startBuyNowCheckoutBodySchema })
      ]
    },
    async (request, reply) => {
      const body = startBuyNowCheckoutBodySchema.parse(request.body);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);

        request.log.info(
        {
          productId: body.productId,
          variantId: body.variantId,
          quantity: body.quantity,
          tenantId,
          userId,
          paymentMethod: body.provider ?? app.config.PAYMENT_PROVIDER,
          stripeConfigured: app.config.STRIPE_SECRET_KEY !== undefined
        },
        "Starting buy-now checkout without cart mutation"
      );

      let checkout;

      try {
        request.log.info("BUY_NOW STEP 1: validate product snapshot");
        request.log.info("BUY_NOW STEP 2: reserve inventory");
        request.log.info("BUY_NOW STEP 3: create order");
        request.log.info("BUY_NOW STEP 4: create payment");
        request.log.info(
          {
            paymentMethod: body.provider ?? app.config.PAYMENT_PROVIDER,
            stripeConfigured: app.config.STRIPE_SECRET_KEY !== undefined
          },
          "BUY_NOW STEP 5: initialize payment provider"
        );
        checkout = await options.repository.startBuyNowCheckout({
          ...body,
          tenantId,
          userId
        }, getActor(request));
        request.log.info("BUY_NOW STEP 6: finalize response");
      } catch (error) {
        request.log.error({ err: error, tenantId, userId, productId: body.productId, variantId: body.variantId }, "FAILED BUY-NOW CHECKOUT STEP");
        throw error;
      }

      await enqueueOrderCreatedEmail(request, checkout);

      await reply.status(201).send({
        ok: true,
        data: checkout
      });
    }
  );
};
