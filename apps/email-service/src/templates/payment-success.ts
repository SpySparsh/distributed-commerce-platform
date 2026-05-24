import type { RenderedEmail } from "../types/email.js";
import { escapeHtml, toDisplayValue, toMoney } from "../utils/html.js";
import { renderLayout } from "./layout.js";

export const renderPaymentSuccess = (variables: Record<string, unknown>): RenderedEmail => {
  const orderId = toDisplayValue(variables["orderId"] ?? variables["orderNumber"]);
  const amount = toMoney(variables["paymentAmount"] ?? variables["amount"] ?? variables["total"] ?? variables["totalAmount"]);
  const currency = toDisplayValue(variables["currency"], "");
  const provider = toDisplayValue(variables["paymentProvider"] ?? variables["provider"], "Stripe");
  const paidAt = toDisplayValue(variables["paidAt"], new Date().toISOString());

  const html = renderLayout({
    title: "Payment Successful",
    preheader: `Payment for order ${orderId} was successful.`,
    bodyHtml: `
      <p>We have received your payment successfully.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6b7280;">Order</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(orderId)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(`${currency} ${amount}`.trim())}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Provider</td><td style="padding:8px 0;text-align:right;">${escapeHtml(provider)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Paid at</td><td style="padding:8px 0;text-align:right;">${escapeHtml(paidAt)}</td></tr>
      </table>
    `
  });

  return {
    subject: `Payment Successful ${orderId}`,
    html,
    text: `Payment successful for order ${orderId}. Amount: ${`${currency} ${amount}`.trim()}. Provider: ${provider}. Paid at: ${paidAt}.`
  };
};
