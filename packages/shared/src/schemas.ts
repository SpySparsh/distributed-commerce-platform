import { z } from "zod";
import {
  cartItemSchema,
  paymentMethodSchema,
  productSummarySchema,
  shippingInfoSchema,
  userSummarySchema
} from "./domain";

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8)
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const authResponseSchema = z.object({
  user: userSummarySchema,
  accessToken: z.string().optional()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const productListResponseSchema = z.object({
  products: z.array(productSummarySchema)
});

export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const cartResponseSchema = z.object({
  items: z.array(cartItemSchema)
});

export type CartResponse = z.infer<typeof cartResponseSchema>;

export const createOrderRequestSchema = z.object({
  orderItems: z.array(cartItemSchema).min(1),
  shippingInfo: shippingInfoSchema,
  paymentMethod: paymentMethodSchema
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const createReviewRequestSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional()
});

export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;
