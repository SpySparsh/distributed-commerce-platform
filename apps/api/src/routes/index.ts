import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { cartRoutes } from "../modules/carts/cart.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { inventoryRoutes } from "../modules/inventory/inventory.routes.js";
import { paymentRoutes } from "../modules/payments/payment.routes.js";
import { productRoutes } from "../modules/products/product.routes.js";
import { searchRoutes } from "../modules/search/search.routes.js";

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(cartRoutes, { prefix: "/carts" });
  await app.register(productRoutes, { prefix: "/products" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(paymentRoutes, { prefix: "/payments" });
  await app.register(searchRoutes, { prefix: "/search" });
  await app.register(healthRoutes, { prefix: "/health" });
};
