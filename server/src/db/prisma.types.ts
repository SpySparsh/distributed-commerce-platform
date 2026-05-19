import type { ProductSummary, UserSummary } from "@ecommerce/shared";

export const productSummarySelect = {
  id: true,
  name: true,
  description: true,
  brand: true,
  price: true,
  category: true,
  countInStock: true,
  image: true,
  rating: true,
  numReviews: true
} as const;

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true
} as const;

export type ProductSummaryRow = {
  [K in keyof typeof productSummarySelect]: ProductSummary[K];
};

export type UserSummaryRow = {
  [K in keyof typeof userSummarySelect]: UserSummary[K];
};

export const toProductSummary = (product: ProductSummaryRow): ProductSummary => ({
  id: product.id,
  name: product.name,
  description: product.description,
  brand: product.brand,
  price: product.price,
  category: product.category,
  countInStock: product.countInStock,
  image: product.image,
  rating: product.rating,
  numReviews: product.numReviews
});

export const toUserSummary = (user: UserSummaryRow): UserSummary => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});
