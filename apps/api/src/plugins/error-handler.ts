import { ZodError } from "zod";
import { RequestValidationError } from "@ecommerce/validation";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface ErrorResponse {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlationId: string;
    readonly fieldErrors?: Record<string, readonly string[]>;
  };
}

const toFieldErrors = (error: ZodError): Record<string, readonly string[]> =>
  error.issues.reduce<Record<string, readonly string[]>>((fieldErrors, issue) => {
    const field = issue.path.join(".") || "root";
    return {
      ...fieldErrors,
      [field]: [...(fieldErrors[field] ?? []), issue.message]
    };
  }, {});

const getStatusCode = (error: FastifyError | Error): number => {
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if (error instanceof ZodError) {
    return 400;
  }

  if (error instanceof RequestValidationError) {
    return error.statusCode;
  }

  return 500;
};

const getErrorCode = (statusCode: number, error: FastifyError | Error): string => {
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (error instanceof ZodError) {
    return "VALIDATION_ERROR";
  }

  if (statusCode === 404) {
    return "NOT_FOUND";
  }

  if (statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }

  return "INTERNAL_SERVER_ERROR";
};

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setNotFoundHandler(async (request, reply) => {
    await reply.status(404).send({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        correlationId: request.correlationId
      }
    } satisfies ErrorResponse);
  });

  app.setErrorHandler(
    async (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = getStatusCode(error);
      const message = statusCode >= 500 ? "Internal server error" : error.message;

      request.log.error(
        {
          correlationId: request.correlationId,
          error
        },
        "Unhandled request error"
      );

      const response: ErrorResponse = {
        ok: false,
        error: {
          code: getErrorCode(statusCode, error),
          message,
          correlationId: request.correlationId,
          ...(error instanceof ZodError ? { fieldErrors: toFieldErrors(error) } : {}),
          ...(error instanceof RequestValidationError ? { fieldErrors: error.fieldErrors } : {})
        }
      };

      await reply.status(statusCode).send(response);
    }
  );
};
