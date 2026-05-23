export const permissions = {
  cartsRead: "carts:read",
  cartsWrite: "carts:write",
  checkoutWrite: "checkout:write",
  inventoryRead: "inventory:read",
  inventoryWrite: "inventory:write",
  ordersRead: "orders:read",
  ordersWrite: "orders:write",
  paymentsRead: "payments:read",
  paymentsWrite: "payments:write",
  reviewsRead: "reviews:read",
  reviewsWrite: "reviews:write",
  reviewsModerate: "reviews:moderate",
  eventsPublish: "events:publish",
  searchAdmin: "search:admin"
} as const;
