import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import type { PaymentRepository } from "./payment.repository.js";
import {
  initiatePaymentBodySchema,
  paymentParamsSchema,
  paymentRetryBodySchema,
  paymentTenantQuerySchema,
  webhookParamsSchema
} from "./payment.schemas.js";
import { createPaymentService } from "./payment.service.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

const getHeaderValue = (header: string | string[] | undefined): string | undefined =>
  Array.isArray(header) ? header[0] : header;

const isWebhookRequest = (url: string | undefined): boolean =>
  url?.includes("/webhooks/") === true || url?.includes("/stripe/webhook") === true;

const readPayloadBuffer = async (payload: AsyncIterable<unknown>): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks);
};

export interface PaymentRouteOptions {
  readonly repository: PaymentRepository;
}

export const paymentRoutes: FastifyPluginAsync<PaymentRouteOptions> = async (app, options) => {
  const service = createPaymentService(
    options.repository,
    app.queues,
    app.config
  );

  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!isWebhookRequest(request.url)) {
      return payload;
    }

    const rawPayload = await readPayloadBuffer(payload);
    request.rawBody = rawPayload.toString("utf8");
    return Readable.from(rawPayload);
  });

  app.post(
    "/",
    {
      preHandler: [
        requirePermission(permissions.paymentsWrite),
        withRateLimit({ keyPrefix: "payments:initiate", maxRequests: 60 }),
        validateRequest({ body: initiatePaymentBodySchema })
      ]
    },
    async (request, reply) => {
      const body = initiatePaymentBodySchema.parse(request.body);
      const payment = await service.initiatePayment({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

      await reply.status(201).send({
        ok: true,
        data: payment
      });
    }
  );

  app.get(
    "/:paymentId",
    {
      preHandler: [
        requirePermission(permissions.paymentsRead),
        withRateLimit({ keyPrefix: "payments:get", maxRequests: 120 }),
        validateRequest({
          params: paymentParamsSchema,
          query: paymentTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = paymentParamsSchema.parse(request.params);
      paymentTenantQuerySchema.parse(request.query);
      const payment = await service.getPayment(getAuthenticatedTenantId(request), params.paymentId);

      if (payment === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "Payment not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          payment
        }
      };
    }
  );

  app.post(
    "/retry",
    {
      preHandler: [
        requirePermission(permissions.paymentsWrite),
        withRateLimit({ keyPrefix: "payments:retry", maxRequests: 30 }),
        validateRequest({ body: paymentRetryBodySchema })
      ]
    },
    async (request) => {
      const body = paymentRetryBodySchema.parse(request.body);
      const jobId = await service.schedulePaymentRetry({
        ...body,
        tenantId: getAuthenticatedTenantId(request)
      });

      return {
        ok: true,
        data: {
          jobId
        }
      };
    }
  );

  app.post(
    "/webhooks/:provider",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "payments:webhook", maxRequests: 1_000 }),
        validateRequest({
          params: webhookParamsSchema
        })
      ]
    },
    async (request) => {
      const params = webhookParamsSchema.parse(request.params);
      const signature = getHeaderValue(request.headers["stripe-signature"]);
      const result = await service.handleWebhook({
        provider: params.provider,
        rawBody: request.rawBody ?? "",
        signature
      });

      return {
        ok: true,
        data: result
      };
    }
  );

  app.post(
    "/stripe/webhook",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "payments:stripe-webhook", maxRequests: 1_000 })
      ]
    },
    async (request) => {
      const signature = getHeaderValue(request.headers["stripe-signature"]);
      const result = await service.handleWebhook({
        provider: "stripe",
        rawBody: request.rawBody ?? "",
        signature
      });

      return {
        ok: true,
        data: result
      };
    }
  );
};
