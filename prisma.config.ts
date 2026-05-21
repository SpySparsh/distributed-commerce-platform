import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({
  path: path.resolve(__dirname, ".env")
});

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL or DIRECT_URL is required");
}

export default defineConfig({
  schema: "packages/database/prisma/schema.prisma",
  migrations: {
    path: "packages/database/prisma/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});
