import { escapeHtml } from "../utils/html.js";

export interface EmailLayoutInput {
  readonly title: string;
  readonly preheader: string;
  readonly bodyHtml: string;
  readonly cta?: {
    readonly label: string;
    readonly href: string;
  };
}

export const renderLayout = ({
  title,
  preheader,
  bodyHtml,
  cta
}: EmailLayoutInput): string => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
    <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #eef0f3;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.65;">
                ${bodyHtml}
                ${cta === undefined ? "" : `
                  <p style="margin:28px 0 0;">
                    <a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
                      ${escapeHtml(cta.label)}
                    </a>
                  </p>
                `}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;">
                This is a transactional email from your ecommerce platform.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
