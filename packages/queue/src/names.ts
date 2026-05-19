export const queueNames = {
  email: "email",
  invoice: "invoice",
  analytics: "analytics",
  paymentRetry: "payment-retry",
  stockSync: "stock-sync",
  inventory: "inventory",
  search: "search",
  domainEvents: "domain-events",
  deadLetter: "dead-letter"
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export const jobNames = {
  sendEmail: "email.send",
  generateInvoice: "invoice.generate",
  trackAnalytics: "analytics.track",
  retryPayment: "payment.retry",
  syncStock: "stock.sync",
  releaseExpiredInventoryReservations: "inventory.reservations.releaseExpired",
  reconcileInventoryReservations: "inventory.reservations.reconcile",
  indexProductSearchDocument: "search.product.index",
  deleteProductSearchDocument: "search.product.delete",
  rebuildSearchIndex: "search.index.rebuild",
  dispatchDomainEvent: "domain-event.dispatch",
  deadLetter: "dead-letter.record"
} as const;

export type JobName = (typeof jobNames)[keyof typeof jobNames];
