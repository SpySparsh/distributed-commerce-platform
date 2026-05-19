import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError, toFieldErrors } from "@ecommerce/shared";

interface RequestSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export const validateRequest =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const bodyResult = schemas.body?.safeParse(req.body);
    const queryResult = schemas.query?.safeParse(req.query);
    const paramsResult = schemas.params?.safeParse(req.params);

    const fieldErrors = {
      ...(bodyResult?.success === false ? toFieldErrors(bodyResult.error) : {}),
      ...(queryResult?.success === false ? toFieldErrors(queryResult.error) : {}),
      ...(paramsResult?.success === false ? toFieldErrors(paramsResult.error) : {})
    };

    if (Object.keys(fieldErrors).length > 0) {
      next(
        new AppError({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          fieldErrors
        })
      );
      return;
    }

    if (bodyResult?.success === true) {
      req.body = bodyResult.data;
    }

    if (queryResult?.success === true) {
      req.query = queryResult.data as Request["query"];
    }

    if (paramsResult?.success === true) {
      req.params = paramsResult.data as Request["params"];
    }

    next();
  };
