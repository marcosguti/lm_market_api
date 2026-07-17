import { bodyText, BRAND, emailLayout, footer, greeting, header, mutedText } from './common.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const getOrderCancelledTemplate = ({
  firstName,
  reason,
  shortOrderId,
}: {
  firstName: string;
  reason: string;
  shortOrderId: string;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${greeting(firstName)}
      ${bodyText(`Te informamos que tu orden ${shortOrderId} fue cancelada.`)}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        <tr>
          <td
            style="padding: 16px 18px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.border}; border-radius: 12px;"
          >
            <p style="margin: 0 0 8px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.primaryDark};">
              Motivo de cancelación
            </p>
            <p style="margin: 0; font-size: 15px; line-height: 22px; color: ${BRAND.text}; white-space: pre-wrap;">
              ${escapeHtml(reason)}
            </p>
          </td>
        </tr>
      </table>
      ${mutedText(
        'Si tienes dudas sobre esta cancelación, responde a este correo o contáctanos desde LM Market.',
      )}
      ${footer()}
    `,
    preheader: `Tu orden ${shortOrderId} fue cancelada.`,
    title: 'Tu orden fue cancelada — LM Market',
  });
