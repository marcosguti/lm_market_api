import {
  bodyText,
  BRAND,
  emailLayout,
  footer,
  greeting,
  header,
  mutedText,
  primaryButton,
} from './common.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const passwordBox = (password: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
    <tr>
      <td
        align="center"
        style="padding: 20px 24px; background-color: ${BRAND.primaryLight}; border: 1px solid ${BRAND.primary}; border-radius: 12px;"
      >
        <p style="margin: 0 0 8px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND.primaryDark};">
          Contraseña temporal
        </p>
        <p style="margin: 0; font-size: 22px; line-height: 28px; font-weight: 800; letter-spacing: 2px; color: ${BRAND.text}; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; word-break: break-all;">
          ${escapeHtml(password)}
        </p>
      </td>
    </tr>
  </table>
`;

export const getAdminAccountCreatedTemplate = ({
  firstName,
  recoverPasswordUrl,
  roleLabel,
  temporaryPassword,
}: {
  firstName: string;
  recoverPasswordUrl: string;
  roleLabel: string;
  temporaryPassword: string;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${greeting(firstName)}
      ${bodyText('Se ha creado tu cuenta en LM Market.')}
      ${bodyText(`Tu rol asignado es: ${roleLabel}.`)}
      ${bodyText('Usa la siguiente contraseña temporal para iniciar sesión:')}
      ${passwordBox(temporaryPassword)}
      ${bodyText('Puedes cambiar tu contraseña en cualquier momento usando Recuperar contraseña.')}
      ${primaryButton(recoverPasswordUrl, 'Recuperar contraseña')}
      <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${BRAND.textMuted}; word-break: break-all;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <a href="${recoverPasswordUrl}" style="color: ${BRAND.primary}; text-decoration: underline; font-weight: 600;">
          ${escapeHtml(recoverPasswordUrl)}
        </a>
      </p>
      ${mutedText('Si no esperabas este correo, contacta a soporte.')}
      ${footer()}
    `,
    preheader: 'Tu cuenta en LM Market ha sido creada. Aquí están tu rol y contraseña temporal.',
    title: 'Cuenta creada — LM Market',
  });
