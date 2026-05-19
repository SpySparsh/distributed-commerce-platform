import { sanitizeInput } from "@ecommerce/validation";
import fp from "fastify-plugin";

export const sanitizationPlugin = fp(
  async (app) => {
    app.addHook("preValidation", async (request) => {
      request.body = sanitizeInput(request.body);
      request.query = sanitizeInput(request.query) as typeof request.query;
      request.params = sanitizeInput(request.params) as typeof request.params;
    });
  },
  {
    name: "sanitization"
  }
);
