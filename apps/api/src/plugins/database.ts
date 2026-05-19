import { PrismaClient } from "@ecommerce/database";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const databasePlugin = fp(
  async (app) => {
    const prisma = new PrismaClient({
      log:
        app.config.NODE_ENV === "production"
          ? ["error", "warn"]
          : ["query", "error", "warn"]
    });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;

    app.decorate("prisma", prisma);

    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  },
  {
    name: "database",
    dependencies: ["config"]
  }
);
