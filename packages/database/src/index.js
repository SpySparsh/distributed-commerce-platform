import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export { Prisma, PrismaClient } from "@prisma/client";
export const databaseProvider = "postgresql";
export const createPrismaClient = ({ databaseUrl, log }) => {
    const adapter = new PrismaPg({
        connectionString: databaseUrl
    });
    return new PrismaClient({
        adapter,
        ...(log === undefined ? {} : { log })
    });
};
