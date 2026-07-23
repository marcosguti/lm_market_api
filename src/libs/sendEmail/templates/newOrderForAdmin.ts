import { bodyText, BRAND, emailLayout, footer, greeting, header, mutedText } from './common.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const getNewOrderForAdminTemplate = ({
  firstName,
  shortOrderId,
  statusLabel,
}: {
  firstName: string;
  shortOrderId: string;
  statusLabel: string;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${greeting(firstName)}
      ${bodyText(
        'Hay una nueva orden por gestionar. Por favor revísala desde el panel de órdenes ingresando el id de la orden.',
      )}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        <tr>
          <td
            style="padding: 16px 18px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.border}; border-radius: 12px;"
          >
            <p style="margin: 0 0 12px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.primaryDark};">
              Detalle de la orden
            </p>
            <p style="margin: 0 0 8px; font-size: 15px; line-height: 22px; color: ${BRAND.text};">
              <strong>Orden:</strong> ${escapeHtml(shortOrderId)}
            </p>
            <p style="margin: 0; font-size: 15px; line-height: 22px; color: ${BRAND.text};">
              <strong>Status:</strong> ${escapeHtml(statusLabel)}
            </p>
          </td>
        </tr>
      </table>
      ${mutedText('Este aviso se envía automáticamente a los administradores de la tienda.')}
      ${footer()}
    `,
    preheader: `Nueva orden ${shortOrderId} — ${statusLabel}`,
    title: `Nueva orden ${shortOrderId} — LM Market`,
  });
