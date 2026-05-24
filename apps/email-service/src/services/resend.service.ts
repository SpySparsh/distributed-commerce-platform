interface EmailLogger {
  error: (object: Record<string, unknown>, message: string) => void;
}

export interface ResendServiceOptions {
  readonly apiKey: string;
  readonly from: string;
  readonly logger: EmailLogger;
}

export interface SendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly idempotencyKey: string;
}

export interface SendEmailResult {
  readonly providerMessageId: string;
}

export const createResendService = ({
  apiKey,
  from,
  logger
}: ResendServiceOptions) => ({
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    });

    const body = await response.json().catch(() => undefined) as { id?: string; message?: string } | undefined;

    if (!response.ok) {
      logger.error(
        {
          statusCode: response.status,
          providerMessage: body?.message
        },
        "Resend email request failed"
      );
      throw new Error(`Resend request failed with status ${response.status}`);
    }

    return {
      providerMessageId: body?.id ?? "unknown"
    };
  }
});
