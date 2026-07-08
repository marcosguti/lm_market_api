import { LOGO_CONTENT_ID } from '../logo.js';

export const BRAND = {
  background: '#F3F4F6',
  border: '#E5E7EB',
  primary: '#97BD11',
  primaryDark: '#7A9A0E',
  primaryLight: '#F4F9E8',
  text: '#1A2021',
  textMuted: '#6B7280',
  white: '#FFFFFF',
} as const;

const LOGO_SRC = `cid:${LOGO_CONTENT_ID}`;
const SITE_URL = 'https://www.lmmarket.com';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const header = (): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
    <tr>
      <td align="center" style="padding: 0;">
        <img
          alt="LM Market"
          src="${LOGO_SRC}"
          width="90"
          height="72"
          style="display: block; width: 90px; height: 72px; border: 0; margin: 0 auto 12px;"
        />
        <p style="margin: 0; font-size: 22px; line-height: 28px; font-weight: 700; color: ${BRAND.text}; letter-spacing: -0.02em;">
          LM Market
        </p>
      </td>
    </tr>
  </table>
`;

export const footer = (): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 32px;">
    <tr>
      <td align="center" style="padding-top: 24px; border-top: 1px solid ${BRAND.border};">
        <p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: ${BRAND.textMuted};">
          © ${new Date().getFullYear()} LM Market
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 20px;">
          <a href="${SITE_URL}" style="color: ${BRAND.primary}; text-decoration: none; font-weight: 600;">
            lmmarket.com
          </a>
        </p>
      </td>
    </tr>
  </table>
`;

export const greeting = (firstName: string): string => `
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: ${BRAND.text};">
    Hola${firstName ? ` ${escapeHtml(firstName)}` : ''},
  </p>
`;

export const mutedText = (text: string): string => `
  <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: ${BRAND.textMuted};">
    ${escapeHtml(text)}
  </p>
`;

export const bodyText = (text: string): string => `
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: ${BRAND.text};">
    ${escapeHtml(text)}
  </p>
`;

export const primaryButton = (href: string, label: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px;">
    <tr>
      <td align="center" bgcolor="${BRAND.primary}" style="border-radius: 10px; background-color: ${BRAND.primary};">
        <a
          href="${href}"
          style="display: inline-block; padding: 14px 28px; font-size: 15px; line-height: 20px; font-weight: 700; color: ${BRAND.white}; text-decoration: none; border-radius: 10px;"
        >
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>
`;

export const codeBox = (code: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
    <tr>
      <td
        align="center"
        style="padding: 20px 24px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.primary}; border-radius: 12px;"
      >
        <p style="margin: 0 0 8px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND.primaryDark};">
          Tu código de verificación
        </p>
        <p style="margin: 0; font-size: 36px; line-height: 42px; font-weight: 800; letter-spacing: 10px; color: ${BRAND.text}; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">
          ${escapeHtml(code)}
        </p>
      </td>
    </tr>
  </table>
`;

export const emailLayout = ({
  contentHtml,
  preheader,
  title,
}: {
  contentHtml: string;
  preheader: string;
  title: string;
}): string => `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${escapeHtml(title)}</title>
    <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, sans-serif !important; }
      </style>
    <![endif]-->
  </head>
  <body style="margin: 0; padding: 0; width: 100% !important; background-color: ${BRAND.background}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND.background};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: ${BRAND.white}; border: 1px solid ${BRAND.border}; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(26, 32, 33, 0.06);">
            <tr>
              <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${BRAND.primary};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${contentHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
