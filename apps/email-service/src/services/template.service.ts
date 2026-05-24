import type { EmailTemplate, RenderedEmail } from "../types/email.js";
import { renderDeliveryConfirmation } from "../templates/delivery-confirmation.js";
import { renderOrderConfirmation } from "../templates/order-confirmation.js";
import { renderPaymentSuccess } from "../templates/payment-success.js";
import { renderReviewCta } from "../templates/review-cta.js";

export const renderEmailTemplate = (
  template: EmailTemplate,
  variables: Record<string, unknown>
): RenderedEmail => {
  switch (template) {
    case "order-confirmation":
      return renderOrderConfirmation(variables);
    case "payment-success":
      return renderPaymentSuccess(variables);
    case "order-delivered":
    case "delivery-confirmation":
      return renderDeliveryConfirmation(variables);
    case "review-cta":
      return renderReviewCta(variables);
  }
};
