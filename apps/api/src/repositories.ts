import type { PrismaClient } from "@ecommerce/database";
import type { ApiEnv } from "./env.js";
import { PrismaAuthRepository } from "./modules/auth/prisma-auth.repository.js";
import { PrismaCartRepository } from "./modules/carts/prisma-cart.repository.js";
import { PrismaCartInventoryReader } from "./modules/carts/inventory.reader.js";
import { PrismaCheckoutRepository } from "./modules/checkout/checkout.repository.js";
import { PrismaEventLogRepository } from "./modules/events/prisma-event-log.repository.js";
import { PrismaInventoryRepository } from "./modules/inventory/prisma-inventory.repository.js";
import { PrismaOrderRepository } from "./modules/orders/prisma-order.repository.js";
import { PrismaPaymentRepository } from "./modules/payments/prisma-payment.repository.js";
import { PrismaProductRepository } from "./modules/products/prisma-product.repository.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import type { CartRepository } from "./modules/carts/cart.repository.js";
import type { CartInventoryReader } from "./modules/carts/inventory.reader.js";
import type { CheckoutRepository } from "./modules/checkout/checkout.repository.js";
import type { EventLogRepository } from "./modules/events/event-log.repository.js";
import type { InventoryRepository } from "./modules/inventory/inventory.repository.js";
import type { OrderRepository } from "./modules/orders/order.repository.js";
import type { PaymentRepository } from "./modules/payments/payment.repository.js";
import type { ProductRepository } from "./modules/products/product.repository.js";

export interface AppRepositories {
  readonly auth: AuthRepository;
  readonly cart: CartRepository;
  readonly cartInventory: CartInventoryReader;
  readonly checkout: CheckoutRepository;
  readonly eventLog: EventLogRepository;
  readonly inventory: InventoryRepository;
  readonly order: OrderRepository;
  readonly payment: PaymentRepository;
  readonly product: ProductRepository;
}

export const createAppRepositories = (
  prisma: PrismaClient,
  env: ApiEnv
): AppRepositories => ({
  auth: new PrismaAuthRepository(prisma),
  cart: new PrismaCartRepository(prisma),
  cartInventory: new PrismaCartInventoryReader(prisma),
  checkout: new PrismaCheckoutRepository(prisma, env),
  eventLog: new PrismaEventLogRepository(prisma),
  inventory: new PrismaInventoryRepository(prisma),
  order: new PrismaOrderRepository(prisma),
  payment: new PrismaPaymentRepository(prisma),
  product: new PrismaProductRepository(prisma)
});
