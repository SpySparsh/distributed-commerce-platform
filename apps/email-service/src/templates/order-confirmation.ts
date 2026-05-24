import type { RenderedEmail } from "../types/email.js";
import { escapeHtml, toDisplayValue, toMoney } from "../utils/html.js";
import { renderLayout } from "./layout.js";

export const renderOrderConfirmation = (variables: Record<string, unknown>): RenderedEmail => {
  const orderId = toDisplayValue(variables["orderId"] ?? variables["orderNumber"]);
  const total = toMoney(variables["total"] ?? variables["totalAmount"]);
  const paymentMethod = toDisplayValue(variables["paymentMethod"]);
  const customerName = toDisplayValue(variables["customerName"] ?? variables["name"], "Customer");

  const html = renderLayout({
    title: "Order Confirmation",
    preheader: `Your order ${orderId} has been created.`,
    bodyHtml: `
      <p>Hello ${escapeHtml(customerName)},</p>
      <p>Your order has been created successfully.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6b7280;">Order</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(orderId)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Payment</td><td style="padding:8px 0;text-align:right;">${escapeHtml(paymentMethod)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(total)}</td></tr>
      </table>
    `
  });

  return {
    subject: `Order Confirmation ${orderId}`,
    html,
    text: `Hello ${customerName}, your order ${orderId} has been created. Total: ${total}. Payment: ${paymentMethod}.`
  };
};
