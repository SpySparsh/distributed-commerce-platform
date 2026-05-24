import type { SendEmailJob } from "@ecommerce/queue";
import type { JobHandlerContext } from "./handlers.js";

export const handleEmailJob = async (
  job: SendEmailJob,
  context: JobHandlerContext
): Promise<void> => {
  if (context.env.EMAIL_WEBHOOK_URL === undefined) {
    throw new Error("EMAIL_WEBHOOK_URL is required to send email jobs");
  }

  if (context.env.EMAIL_SERVICE_SECRET === undefined) {
    throw new Error("EMAIL_SERVICE_SECRET is required to send email jobs");
  }

  const response = await fetch(context.env.EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-email-secret": context.env.EMAIL_SERVICE_SECRET,
      "idempotency-key": job.metadata.idempotencyKey
    },
    body: JSON.stringify({
      tenantId: job.metadata.tenantId,
      to: job.data.to,
      template: job.data.template,
      variables: job.data.variables,
      idempotencyKey: job.metadata.idempotencyKey,
      requestId: job.metadata.requestId
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email provider failed: ${response.status} ${text}`);
  }

  context.logger.info(
    {
      tenantId: job.metadata.tenantId,
      to: job.data.to,
      template: job.data.template,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Email job sent"
  );
};
