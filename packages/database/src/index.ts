import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export { Prisma, PrismaClient } from "@prisma/client";
export type { PrismaClient as EcommercePrismaClient } from "@prisma/client";

export interface DatabaseHealth {
  readonly status: "up" | "down";
  readonly provider: "postgresql";
}

export const databaseProvider = "postgresql" as const;

export interface CreatePrismaClientOptions {
  readonly databaseUrl: string;
  readonly log?: Prisma.LogLevel[];
}

export const createPrismaClient = ({
  databaseUrl,
  log
}: CreatePrismaClientOptions): PrismaClient => {
  const adapter = new PrismaPg({
    connectionString: databaseUrl
  });

  return new PrismaClient({
    adapter,
    ...(log === undefined ? {} : { log })
  });
};
