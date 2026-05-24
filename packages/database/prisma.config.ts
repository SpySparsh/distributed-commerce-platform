import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({
  path: path.resolve(__dirname, "../../.env"),
});

export default defineConfig({
  schema: "./prisma/schema.prisma",

  migrations: {
    path: "./prisma/migrations"
  },

  datasource: {
    url: env("DIRECT_URL")
  }
});
