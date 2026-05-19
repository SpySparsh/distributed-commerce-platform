import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { UnconfiguredPaymentRepository } from "./payment.repository.js";
import {
  initiatePaymentBodySchema,
  paymentParamsSchema,
  paymentRetryBodySchema,
  paymentTenantQuerySchema,
  webhookParamsSchema,
  webhookTenantQuerySchema
} from "./payment.schemas.js";
import { createPaymentService } from "./payment.service.js";

const getHeaderValue = (header: string | string[] | undefined): string | undefined =>
  Array.isArray(header) ? header[0] : header;

const getRawBody = (body: unknown): string =>
  typeof body === "string" || Buffer.isBuffer(body)
    ? body.toString()
    : JSON.stringify(body);

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  const service = createPaymentService(
    new UnconfiguredPaymentRepository(),
    app.queues,
    app.config
  );

  app.post(
    "/",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "payments:initiate", maxRequests: 60 }),
        validateRequest({ body: initiatePaymentBodySchema })
      ]
    },
    async (request, reply) => {
      const body = initiatePaymentBodySchema.parse(request.body);
      const payment = await service.initiatePayment(body);

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
        withRateLimit({ keyPrefix: "payments:get", maxRequests: 120 }),
        validateRequest({
          params: paymentParamsSchema,
          query: paymentTenantQuerySchema
        })
      ]
    },
    async (request, reply) => {
      const params = paymentParamsSchema.parse(request.params);
      const query = paymentTenantQuerySchema.parse(request.query);
      const payment = await service.getPayment(query.tenantId, params.paymentId);

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
        withRateLimit({ keyPrefix: "payments:retry", maxRequests: 30 }),
        validateRequest({ body: paymentRetryBodySchema })
      ]
    },
    async (request) => {
      const body = paymentRetryBodySchema.parse(request.body);
      const jobId = await service.schedulePaymentRetry(body);

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
          params: webhookParamsSchema,
          query: webhookTenantQuerySchema
        })
      ]
    },
    async (request) => {
      const params = webhookParamsSchema.parse(request.params);
      const query = webhookTenantQuerySchema.parse(request.query);
      const signature =
        params.provider === "stripe"
          ? getHeaderValue(request.headers["stripe-signature"])
          : getHeaderValue(request.headers["x-razorpay-signature"]);
      const result = await service.handleWebhook({
        tenantId: query.tenantId,
        provider: params.provider,
        rawBody: getRawBody(request.body),
        signature
      });

      return {
        ok: true,
        data: result
      };
    }
  );
};
