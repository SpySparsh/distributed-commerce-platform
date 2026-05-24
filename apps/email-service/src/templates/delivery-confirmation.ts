import type { RenderedEmail } from "../types/email.js";
import { escapeHtml, toDisplayValue } from "../utils/html.js";
import { renderLayout } from "./layout.js";

export const renderDeliveryConfirmation = (variables: Record<string, unknown>): RenderedEmail => {
  const orderId = toDisplayValue(variables["orderId"] ?? variables["orderNumber"]);
  const deliveredAt = toDisplayValue(variables["deliveredAt"], new Date().toISOString());
  const reviewUrl = typeof variables["reviewUrl"] === "string" ? variables["reviewUrl"] : undefined;
  const products = Array.isArray(variables["products"]) ? variables["products"] : [];
  const productRows = products
    .map((product) => {
      if (typeof product !== "object" || product === null) {
        return "";
      }

      const row = product as Record<string, unknown>;
      return `<li>${escapeHtml(toDisplayValue(row["name"], "Product unavailable"))} x ${escapeHtml(toDisplayValue(row["quantity"], "1"))}</li>`;
    })
    .join("");
  const firstReviewUrl = products
    .map((product) => typeof product === "object" && product !== null ? (product as Record<string, unknown>)["reviewUrl"] : undefined)
    .find((url): url is string => typeof url === "string") ?? reviewUrl;

  const cta = reviewUrl === undefined ? {} : {
    cta: {
      label: "Write a review",
      href: reviewUrl
    }
  };

  const html = renderLayout({
    title: "Order Delivered",
    preheader: `Your order ${orderId} has been delivered.`,
    bodyHtml: `
      <p>Your order has been delivered. Thank you for shopping with us.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6b7280;">Order</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(orderId)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Delivered at</td><td style="padding:8px 0;text-align:right;">${escapeHtml(deliveredAt)}</td></tr>
      </table>
      ${productRows.length === 0 ? "" : `<ul style="margin:20px 0 0;padding-left:20px;">${productRows}</ul>`}
      <p style="margin-top:20px;">Your feedback helps future shoppers make better decisions.</p>
    `,
    ...(firstReviewUrl === undefined ? cta : { cta: { label: "Write a review", href: firstReviewUrl } })
  });

  return {
    subject: `Order Delivered ${orderId}`,
    html,
    text: `Your order ${orderId} was delivered at ${deliveredAt}.${reviewUrl === undefined ? "" : ` Review it here: ${reviewUrl}`}`
  };
};
