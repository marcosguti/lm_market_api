import { bodyText, BRAND, emailLayout, footer, header, mutedText } from './common.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const detailRow = (label: string, value: string): string => `
  <tr>
    <td style="padding: 8px 0; font-size: 13px; line-height: 20px; font-weight: 600; color: ${BRAND.textMuted}; width: 140px; vertical-align: top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding: 8px 0; font-size: 15px; line-height: 22px; color: ${BRAND.text}; vertical-align: top;">
      ${value}
    </td>
  </tr>
`;

export const getOpsAlertTemplate = ({
  detailsText,
  error,
  job,
  status,
}: {
  detailsText?: null | string;
  error?: null | string;
  job: string;
  status: string;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${bodyText('Hay un problema con una sincronización de LM Market.')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        ${detailRow('Job', escapeHtml(job))}
        ${detailRow('Estado', escapeHtml(status))}
        ${error ? detailRow('Error', escapeHtml(error)) : ''}
      </table>
      ${
        detailsText
          ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        <tr>
          <td
            style="padding: 16px 18px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.border}; border-radius: 12px;"
          >
            <p style="margin: 0 0 8px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.primaryDark};">
              Detalles
            </p>
            <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${BRAND.text}; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
              ${escapeHtml(detailsText)}
            </p>
          </td>
        </tr>
      </table>
      `
          : ''
      }
      ${mutedText('Revisa el panel de sincronización o el endpoint /health/sync.')}
      ${footer()}
    `,
    preheader: `Alerta sync: ${job} → ${status}`,
    title: 'Alerta de sincronización — LM Market',
  });
