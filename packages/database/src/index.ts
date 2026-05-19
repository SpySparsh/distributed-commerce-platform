export { Prisma, PrismaClient } from "@prisma/client";
export type { PrismaClient as EcommercePrismaClient } from "@prisma/client";

export interface DatabaseHealth {
  readonly status: "up" | "down";
  readonly provider: "postgresql";
}

export const databaseProvider = "postgresql" as const;
