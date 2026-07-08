import { bodyText, codeBox, emailLayout, footer, greeting, header, mutedText } from './common.js';

export const getEmailVerificationTemplate = ({
  code,
  firstName,
  ttlMinutes,
}: {
  code: string;
  firstName: string;
  ttlMinutes: number;
}): string =>
  emailLayout({
    contentHtml: `
      ${header()}
      ${greeting(firstName)}
      ${bodyText('Usa este código para verificar tu correo y activar tu cuenta en LM Market.')}
      ${codeBox(code)}
      ${mutedText(`El código expira en ${ttlMinutes} minutos. Si no creaste una cuenta, puedes ignorar este correo.`)}
      ${footer()}
    `,
    preheader: `Tu código de verificación es ${code}. Expira en ${ttlMinutes} minutos.`,
    title: 'Verifica tu email — LM Market',
  });
