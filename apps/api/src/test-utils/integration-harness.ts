import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@ecommerce/database";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { createTestApiEnv } from "./api-env.js";

export const runIntegration = process.env["RUN_INTEGRATION"] === "true";

export const describeIntegration = describe.skipIf(!runIntegration);

export const integrationEnv = createTestApiEnv({
  DATABASE_URL: process.env["DATABASE_URL"] ?? "postgresql://ecommerce:ecommerce@localhost:55432/ecommerce_test?schema=public",
  REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:56379/15",
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  STRIPE_SECRET_KEY: "sk_test_mocked"
});

export interface IntegrationHarness {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
}

const cleanup = async (prisma: PrismaClient): Promise<void> => {
  await prisma.$transaction([
    prisma.paymentWebhookEvent.deleteMany(),
    prisma.domainEventLog.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.inventoryReservation.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.session.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany()
  ]);
};

export const createIntegrationHarness = (): IntegrationHarness => {
  if (!runIntegration) {
    return {
      prisma: undefined as unknown as PrismaClient,
      redis: undefined as unknown as Redis
    };
  }

  const prisma = new PrismaClient({
    log: ["error", "warn"]
  });
  const redis = new Redis(integrationEnv.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
  });

  beforeEach(async () => {
    await cleanup(prisma);
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  return {
    prisma,
    redis
  };
};

export const createId = (): string => randomUUID();

export const seedTenant = async (
  prisma: PrismaClient,
  input: { readonly id?: string; readonly slug?: string } = {}
): Promise<{ readonly id: string; readonly slug: string }> => {
  const id = input.id ?? createId();
  const slug = input.slug ?? `tenant-${id.slice(0, 8)}`;
  await prisma.tenant.create({
    data: {
      id,
      name: slug,
      slug
    }
  });

  return {
    id,
    slug
  };
};

export const seedUser = async (
  prisma: PrismaClient,
  input: {
    readonly tenantId: string;
    readonly email?: string;
    readonly passwordHash?: string;
  }
): Promise<{ readonly id: string; readonly email: string }> => {
  const email = input.email ?? `buyer-${createId()}@example.com`;
  const user = await prisma.user.create({
    data: {
      tenantId: input.tenantId,
      email,
      passwordHash: input.passwordHash ?? "not-used-in-this-test"
    }
  });

  return {
    id: user.id,
    email
  };
};

export const seedProductWithInventory = async (
  prisma: PrismaClient,
  input: {
    readonly tenantId: string;
    readonly quantity: number;
    readonly reserved?: number;
    readonly price?: string;
  }
): Promise<{
  readonly productId: string;
  readonly variantId: string;
  readonly inventoryItemId: string;
}> => {
  const product = await prisma.product.create({
    data: {
      tenantId: input.tenantId,
      sku: `sku-${createId()}`,
      slug: `product-${createId()}`,
      name: "Integration Product",
      status: "active"
    }
  });
  const variant = await prisma.productVariant.create({
    data: {
      tenantId: input.tenantId,
      productId: product.id,
      sku: `variant-${createId()}`,
      name: "Default",
      price: new Prisma.Decimal(input.price ?? "25.00"),
      currency: "USD",
      status: "active"
    }
  });
  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      tenantId: input.tenantId,
      variantId: variant.id,
      quantity: input.quantity,
      reserved: input.reserved ?? 0
    }
  });

  return {
    productId: product.id,
    variantId: variant.id,
    inventoryItemId: inventoryItem.id
  };
};
