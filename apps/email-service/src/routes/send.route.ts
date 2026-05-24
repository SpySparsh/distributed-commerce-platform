import type { FastifyPluginAsync } from "fastify";
import type { EmailServiceEnv } from "../env.js";
import { createInternalAuthMiddleware } from "../middleware/auth.middleware.js";
import { createResendService } from "../services/resend.service.js";
import { renderEmailTemplate } from "../services/template.service.js";
import { sendEmailPayloadSchema } from "../types/email.js";

export interface SendRouteOptions {
  readonly config: EmailServiceEnv;
}

export const sendRoute: FastifyPluginAsync<SendRouteOptions> = async (app, { config }) => {
  const resend = createResendService({
    apiKey: config.RESEND_API_KEY,
    from: config.EMAIL_FROM,
    logger: app.log
  });

  app.post(
    "/send",
    {
      preHandler: createInternalAuthMiddleware(config)
    },
    async (request, reply) => {
      const payload = sendEmailPayloadSchema.parse(request.body);
      const rendered = renderEmailTemplate(payload.template, payload.variables);
      const result = await resend.sendEmail({
        to: payload.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: payload.idempotencyKey
      });

      request.log.info(
        {
          tenantId: payload.tenantId,
          template: payload.template,
          requestId: payload.requestId,
          idempotencyKey: payload.idempotencyKey,
          providerMessageId: result.providerMessageId
        },
        "Transactional email sent"
      );

      await reply.status(202).send({
        ok: true,
        data: {
          provider: "resend",
          providerMessageId: result.providerMessageId
        }
      });
    }
  );
};
