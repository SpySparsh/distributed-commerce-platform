import cookie from "@fastify/cookie";
import fp from "fastify-plugin";

export const cookiePlugin = fp(
  async (app) => {
    await app.register(cookie, {
      hook: "onRequest"
    });
  },
  {
    name: "cookie"
  }
);
