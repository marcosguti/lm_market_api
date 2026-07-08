import { bodyText, codeBox, emailLayout, footer, greeting, header, mutedText } from './common.js';

export const getLoginCodeTemplate = ({
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
      ${bodyText('Usa este código para iniciar sesión en LM Market.')}
      ${codeBox(code)}
      ${mutedText(`El código expira en ${ttlMinutes} minutos. Si no solicitaste acceso, puedes ignorar este correo.`)}
      ${footer()}
    `,
    preheader: `Tu código de acceso es ${code}. Expira en ${ttlMinutes} minutos.`,
    title: 'Tu código de acceso — LM Market',
  });
