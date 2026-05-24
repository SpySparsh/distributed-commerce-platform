import type { RenderedEmail } from "../types/email.js";
import { escapeHtml, toDisplayValue } from "../utils/html.js";
import { renderLayout } from "./layout.js";

export const renderReviewCta = (variables: Record<string, unknown>): RenderedEmail => {
  const productName = toDisplayValue(variables["productName"], "your product");
  const reviewUrl = toDisplayValue(variables["reviewUrl"]);

  const html = renderLayout({
    title: "How was your purchase?",
    preheader: `Review ${productName}.`,
    bodyHtml: `
      <p>We hope you are enjoying ${escapeHtml(productName)}.</p>
      <p>Your verified-purchase review helps other customers.</p>
    `,
    cta: {
      label: "Write a review",
      href: reviewUrl
    }
  });

  return {
    subject: `Review ${productName}`,
    html,
    text: `Review ${productName}: ${reviewUrl}`
  };
};
