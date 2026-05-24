import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

export const securityHeadersPlugin = fp(
  async (app) => {
    const frontendOrigin = new URL(app.config.FRONTEND_URL).origin;

    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          connectSrc: ["'self'", frontendOrigin, "https://api.stripe.com"],
          frameSrc: ["'self'", "https://checkout.stripe.com", "https://js.stripe.com"],
          scriptSrc: ["'self'", "https://js.stripe.com"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
      hsts: app.config.NODE_ENV === "production"
    });
  },
  {
    name: "security-headers",
    dependencies: ["config"]
  }
);
