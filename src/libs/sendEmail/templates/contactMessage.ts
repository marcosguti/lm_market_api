import { bodyText, BRAND, emailLayout, footer, header, mutedText } from './common.js';

const AREA_LABELS: Record<string, string> = {
  contacto: 'Contacto',
  mercadeo: 'Mercadeo',
  soporte: 'Soporte',
  'talento-humano': 'Talento Humano',
  ventas: 'Ventas',
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const detailRow = (label: string, value: string): string => `
  <tr>
    <td style="padding: 8px 0; font-size: 13px; line-height: 20px; font-weight: 600; color: ${BRAND.textMuted}; width: 120px; vertical-align: top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding: 8px 0; font-size: 15px; line-height: 22px; color: ${BRAND.text}; vertical-align: top;">
      ${value}
    </td>
  </tr>
`;

export const getContactMessageTemplate = ({
  area,
  email,
  message,
  name,
  subject,
}: {
  area: string;
  email: string;
  message: string;
  name: string;
  subject: string;
}): string => {
  const areaLabel = AREA_LABELS[area] ?? area;

  return emailLayout({
    contentHtml: `
      ${header()}
      ${bodyText('Has recibido un nuevo mensaje desde el formulario de contacto.')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        ${detailRow('Área', escapeHtml(areaLabel))}
        ${detailRow('Nombre', escapeHtml(name))}
        ${detailRow(
          'Email',
          `<a href="mailto:${escapeHtml(email)}" style="color: ${BRAND.primary}; text-decoration: none; font-weight: 600;">${escapeHtml(email)}</a>`,
        )}
        ${detailRow('Asunto', escapeHtml(subject))}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
        <tr>
          <td
            style="padding: 16px 18px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.border}; border-radius: 12px;"
          >
            <p style="margin: 0 0 8px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.primaryDark};">
              Mensaje
            </p>
            <p style="margin: 0; font-size: 15px; line-height: 22px; color: ${BRAND.text}; white-space: pre-wrap;">
              ${escapeHtml(message)}
            </p>
          </td>
        </tr>
      </table>
      ${mutedText('Puedes responder este correo para contactar directamente al remitente.')}
      ${footer()}
    `,
    preheader: `Nuevo mensaje de ${name}: ${subject}`,
    title: 'Nuevo mensaje de contacto — LM Market',
  });
};
