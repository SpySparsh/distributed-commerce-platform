# Order Management Architecture

Orders are managed through an explicit lifecycle service and state machine. The API never exposes uncontrolled status updates.

## State Machine

Allowed transitions:

- `pending -> confirmed`
- `pending -> cancelled`
- `confirmed -> paid`
- `confirmed -> cancelled`
- `paid -> fulfilled`
- `paid -> refunded`
- `fulfilled -> refunded`

`cancelled` and `refunded` are terminal for normal flows.

## API Surface

- `POST /orders`: creates a pending order snapshot.
- `GET /orders/:orderId`: reads an order.
- `GET /orders/:orderId/events`: reads order history.
- `POST /orders/:orderId/transitions`: applies controlled lifecycle transitions.
- `POST /orders/:orderId/invoice`: records invoice request and enqueues invoice generation.

## Auditability

Two records are written for lifecycle changes:

- `OrderEvent`: customer/support/fulfillment timeline for the order.
- `AuditLog`: compliance-oriented actor and before/after trail.

This separation keeps operational history easy to read while preserving audit semantics.

## Payment Synchronization

Orders do not become `paid` because a browser says payment succeeded. The `paid` transition requires a local payment record in `authorized` or `captured` state.

The payment webhook/reconciliation layer is responsible for moving payment state. The order service consumes that verified local state.

## Inventory Consistency

Inventory is reserved before checkout. When an order transitions to `paid`, reserved inventory is consumed in the same transaction as the order transition:

- order moves to `paid`
- order event is written
- inventory item counters are decremented
- matching reservations are marked `consumed`
- audit log is written

If payment fails or an order is cancelled before payment, reservations should be released through the inventory reservation service.

## Invoice Support

Invoice generation is asynchronous through BullMQ:

- API records `invoice_requested`
- API enqueues `invoice.generate`
- worker generates/stores invoice
- worker should update `invoiceNumber`, `invoiceUrl`, and `invoicedAt`

This keeps the order API fast and avoids blocking user requests on PDF generation or storage.

## Scalability Considerations

- State transitions are transaction-scoped and append events.
- Order reads can be served from PostgreSQL initially, then projected into a read model later.
- Invoice generation and external notifications are async.
- Events are tenant-indexed for support tools and back-office timelines.
- High-volume order exports should page by `(tenantId, createdAt, id)` or `(tenantId, placedAt, id)`.

## Tradeoffs

- Order state is strongly consistent inside PostgreSQL.
- Payment and fulfillment integrations are eventually consistent and reconciled through async jobs.
- Inventory consumption assumes reservations were created before payment; recovery jobs should detect paid orders without consumed inventory events.
