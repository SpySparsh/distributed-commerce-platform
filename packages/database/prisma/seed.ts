import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env["DATABASE_URL"];

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl
});

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"]
});

const permissions = [
  "carts:read",
  "carts:write",
  "checkout:write",
  "inventory:read",
  "inventory:write",
  "orders:read",
  "orders:write",
  "payments:read",
  "payments:write",
  "reviews:read",
  "reviews:write",
  "reviews:moderate",
  "events:publish",
  "search:admin"
] as const;

const customerPermissions = [
  "carts:read",
  "carts:write",
  "checkout:write",
  "orders:read",
  "reviews:read",
  "reviews:write",
  "payments:read"
] as const;

const getRequiredProductionValue = (name: string): string => {
  const value = process.env[name];

  if (process.env["NODE_ENV"] === "production" && (value === undefined || value.length === 0)) {
    throw new Error(`${name} is required for production database seeding`);
  }

  return value ?? "";
};

const seedTenant = async () => {
  const slug = process.env["SEED_TENANT_SLUG"] ?? "demo-store";

  return prisma.tenant.upsert({
    where: {
      slug
    },
    update: {
      name: process.env["SEED_TENANT_NAME"] ?? "Demo Store",
      status: "active",
      deletedAt: null
    },
    create: {
      slug,
      name: process.env["SEED_TENANT_NAME"] ?? "Demo Store",
      status: "active"
    }
  });
};

const seedRole = async (
  tenantId: string,
  input: {
    readonly key: string;
    readonly name: string;
    readonly permissionKeys: readonly string[];
  }
) => {
  const role = await prisma.role.upsert({
    where: {
      tenantId_key: {
        tenantId,
        key: input.key
      }
    },
    update: {
      name: input.name,
      deletedAt: null
    },
    create: {
      tenantId,
      key: input.key,
      name: input.name
    }
  });

  for (const key of input.permissionKeys) {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      }
    });

    await prisma.rolePermission.upsert({
      where: {
        tenantId_roleId_permissionId: {
          tenantId,
          roleId: role.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        tenantId,
        roleId: role.id,
        permissionId: permission.id
      }
    });
  }

  return role;
};

const seedRbac = async (tenantId: string) => {
  for (const key of permissions) {
    await prisma.permission.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      },
      update: {
        deletedAt: null
      },
      create: {
        tenantId,
        key,
        description: `Allows ${key}`
      }
    });
  }

  const adminRole = await seedRole(tenantId, {
    key: "admin",
    name: "Administrator",
    permissionKeys: permissions
  });

  await seedRole(tenantId, {
    key: "customer",
    name: "Customer",
    permissionKeys: customerPermissions
  });

  return {
    adminRole
  };
};

const seedAdminUser = async (tenantId: string, roleId: string) => {
  const configuredEmail = process.env["SEED_ADMIN_EMAIL"];
  const configuredPassword = process.env["SEED_ADMIN_PASSWORD"];
  const email =
    configuredEmail !== undefined && configuredEmail.length > 0
      ? configuredEmail
      : process.env["NODE_ENV"] === "production"
        ? getRequiredProductionValue("SEED_ADMIN_EMAIL")
        : "admin@example.com";
  const password =
    configuredPassword !== undefined && configuredPassword.length > 0
      ? configuredPassword
      : process.env["NODE_ENV"] === "production"
        ? getRequiredProductionValue("SEED_ADMIN_PASSWORD")
        : "ChangeMe12345";

  if (email.length === 0 || password.length === 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email
      }
    },
    update: {
      passwordHash,
      status: "active",
      deletedAt: null
    },
    create: {
      tenantId,
      email,
      passwordHash,
      firstName: "Platform",
      lastName: "Admin",
      status: "active"
    }
  });

  await prisma.userRole.upsert({
    where: {
      tenantId_userId_roleId: {
        tenantId,
        userId: user.id,
        roleId
      }
    },
    update: {},
    create: {
      tenantId,
      userId: user.id,
      roleId
    }
  });
};

const seedCatalog = async (tenantId: string) => {
  const category = await prisma.category.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: "featured"
      }
    },
    update: {
      name: "Featured",
      deletedAt: null
    },
    create: {
      tenantId,
      slug: "featured",
      name: "Featured",
      position: 1
    }
  });

  const product = await prisma.product.upsert({
    where: {
      tenantId_sku: {
        tenantId,
        sku: "DEMO-TEE"
      }
    },
    update: {
      categoryId: category.id,
      slug: "demo-t-shirt",
      name: "Demo T-Shirt",
      status: "active",
      deletedAt: null
    },
    create: {
      tenantId,
      categoryId: category.id,
      sku: "DEMO-TEE",
      slug: "demo-t-shirt",
      name: "Demo T-Shirt",
      description: "Seed product for local checkout and search verification.",
      status: "active"
    }
  });

  const variant = await prisma.productVariant.upsert({
    where: {
      tenantId_sku: {
        tenantId,
        sku: "DEMO-TEE-M"
      }
    },
    update: {
      productId: product.id,
      name: "Medium",
      price: "29.00",
      currency: "USD",
      status: "active",
      deletedAt: null
    },
    create: {
      tenantId,
      productId: product.id,
      sku: "DEMO-TEE-M",
      name: "Medium",
      attributes: {
        size: "M",
        color: "black"
      },
      price: "29.00",
      currency: "USD",
      status: "active"
    }
  });

  await prisma.inventoryItem.upsert({
    where: {
      variantId: variant.id
    },
    update: {
      tenantId,
      quantity: 100,
      reserved: 0,
      safetyStock: 0,
      deletedAt: null
    },
    create: {
      tenantId,
      variantId: variant.id,
      quantity: 100,
      reserved: 0,
      safetyStock: 0
    }
  });
};

const main = async (): Promise<void> => {
  const tenant = await seedTenant();
  const { adminRole } = await seedRbac(tenant.id);
  await seedAdminUser(tenant.id, adminRole.id);
  await seedCatalog(tenant.id);

  console.info(`Seeded tenant '${tenant.slug}' (${tenant.id})`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
