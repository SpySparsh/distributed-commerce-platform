import fp from "fastify-plugin";
import type { ApiEnv } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    config: ApiEnv;
  }
}

export const configPlugin = fp<{ readonly config: ApiEnv }>(
  async (app, options) => {
    app.decorate("config", options.config);
  },
  {
    name: "config"
  }
);
