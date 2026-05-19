import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { cartRoutes } from "../modules/carts/cart.routes.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { eventRoutes } from "../modules/events/event.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { inventoryRoutes } from "../modules/inventory/inventory.routes.js";
import { orderRoutes } from "../modules/orders/order.routes.js";
import { paymentRoutes } from "../modules/payments/payment.routes.js";
import { productRoutes } from "../modules/products/product.routes.js";
import { searchRoutes } from "../modules/search/search.routes.js";
import { createAppRepositories } from "../repositories.js";

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  const repositories = createAppRepositories(app.prisma, app.config);

  await app.register(authRoutes, { prefix: "/auth", repository: repositories.auth });
  await app.register(eventRoutes, { prefix: "/events", repository: repositories.eventLog });
  await app.register(cartRoutes, {
    prefix: "/carts",
    repository: repositories.cart,
    inventory: repositories.cartInventory
  });
  await app.register(checkoutRoutes, { prefix: "/checkout", repository: repositories.checkout });
  await app.register(productRoutes, { prefix: "/products", repository: repositories.product });
  await app.register(inventoryRoutes, { prefix: "/inventory", repository: repositories.inventory });
  await app.register(orderRoutes, { prefix: "/orders", repository: repositories.order });
  await app.register(paymentRoutes, {
    prefix: "/payments",
    repository: repositories.payment
  });
  await app.register(searchRoutes, { prefix: "/search" });
  await app.register(healthRoutes, { prefix: "/health" });
};
