import type { Request } from "express";
import type { z } from "zod";

export type RequestWithBody<TBody> = Request<Record<string, string>, unknown, TBody>;

export type RequestWithQuery<TQuery> = Request<
  Record<string, string>,
  unknown,
  unknown,
  TQuery
>;

export type RequestWithParams<TParams extends Record<string, string>> = Request<
  TParams,
  unknown,
  unknown
>;

export type RequestBody<TSchema extends z.ZodType> = z.output<TSchema>;

export type RequestQuery<TSchema extends z.ZodType> = z.output<TSchema>;

export type RequestParams<TSchema extends z.ZodType> = z.output<TSchema>;
