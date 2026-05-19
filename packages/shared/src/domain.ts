import { z } from "zod";

export const entityIdSchema = z.string().min(1);

export const isoDateStringSchema = z.iso.datetime();

export const userRoleSchema = z.enum(["user", "admin"]);

export const paymentMethodSchema = z.enum(["COD", "Card", "UPI"]);

export type EntityId = z.infer<typeof entityIdSchema>;

export type ISODateString = z.infer<typeof isoDateStringSchema>;

export type UserRole = z.infer<typeof userRoleSchema>;

export const userSummarySchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  email: z.email(),
  role: userRoleSchema
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const productReviewSchema = z.object({
  id: entityIdSchema,
  userId: entityIdSchema,
  name: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  createdAt: isoDateStringSchema
});

export type ProductReview = z.infer<typeof productReviewSchema>;

export const productSummarySchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  brand: z.string().optional(),
  price: z.number().nonnegative(),
  category: z.string().min(1),
  countInStock: z.number().int().nonnegative(),
  image: z.string().url().optional(),
  rating: z.number().min(0).max(5),
  numReviews: z.number().int().nonnegative()
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const cartItemSchema = z.object({
  productId: entityIdSchema,
  quantity: z.number().int().positive()
});

export type CartItem = z.infer<typeof cartItemSchema>;

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const shippingInfoSchema = z.object({
  address: z.string().min(1),
  city: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional()
});

export type ShippingInfo = z.infer<typeof shippingInfoSchema>;

export const orderItemSchema = z.object({
  productId: entityIdSchema,
  quantity: z.number().int().positive()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSummarySchema = z.object({
  id: entityIdSchema,
  userId: entityIdSchema,
  orderItems: z.array(orderItemSchema),
  shippingInfo: shippingInfoSchema,
  paymentMethod: paymentMethodSchema,
  totalAmount: z.number().nonnegative(),
  isPaid: z.boolean(),
  isDelivered: z.boolean(),
  createdAt: isoDateStringSchema
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;
