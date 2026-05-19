import cors from "@fastify/cors";
import fp from "fastify-plugin";

export const corsPlugin = fp(
  async (app) => {
    const allowedOrigins = new Set(
      app.config.CORS_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    );

    await app.register(cors, {
      origin: (origin, callback) => {
        if (origin === undefined || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin is not allowed"), false);
      },
      credentials: true,
      methods: app.config.CORS_ALLOWED_METHODS.split(",").map((method) => method.trim()),
      allowedHeaders: ["content-type", "authorization", app.config.CSRF_HEADER_NAME],
      exposedHeaders: [app.config.REQUEST_ID_HEADER],
      maxAge: 600
    });
  },
  {
    name: "cors",
    dependencies: ["config"]
  }
);
