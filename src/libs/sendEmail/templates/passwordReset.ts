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

export const getPasswordResetTemplate = ({
  firstName,
  resetUrl,
  ttlHours,
}: {
  firstName: string;
  resetUrl: string;
  ttlHours: number;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${greeting(firstName)}
      ${bodyText('Recibimos una solicitud para restablecer la contraseña de tu cuenta en LM Market.')}
      ${bodyText(
        `Haz clic en el botón para elegir una nueva contraseña. Este enlace expira en ${ttlHours} hora${ttlHours === 1 ? '' : 's'}.`,
      )}
      ${primaryButton(resetUrl, 'Restablecer contraseña')}
      ${mutedText('Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no se modificará.')}
      <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${BRAND.textMuted}; word-break: break-all;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <a href="${resetUrl}" style="color: ${BRAND.primary}; text-decoration: underline; font-weight: 600;">
          ${resetUrl}
        </a>
      </p>
      ${footer()}
    `,
    preheader: 'Restablece tu contraseña de LM Market con el enlace de este correo.',
    title: 'Restablece tu contraseña — LM Market',
  });
