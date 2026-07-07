import { footer, header } from './common.js';

export const getPasswordResetTemplate = ({
  firstName,
  resetUrl,
  ttlHours,
}: {
  firstName: string;
  resetUrl: string;
  ttlHours: number;
}) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body {
          height: 100%;
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: #FFF;
          font-family: system-ui, sans-serif;
          font-size: 16px;
          line-height: 24px;
        }
        .body-container {
          margin: 0px 16px 16px;
          border-radius: 8px;
          border: 1px solid #DBDBDB;
          padding: 40px;
        }
        p {
          margin: 0px;
          font-size: initial;
          color: #1A2021;
        }
        .link {
          display: inline-block;
          padding: 12px 16px;
          background-color: #93C01F;
          color: #ffffff !important;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          text-decoration: none;
          margin-top: 16px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="body-container">
        ${header()}
        <p style="margin-bottom: 16px;">Hola${firstName ? ` ${firstName}` : ''},</p>
        <p style="margin-bottom: 16px;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en LM Market.
        </p>
        <p style="margin-bottom: 16px;">
          Haz clic en el botón para elegir una nueva contraseña. Este enlace expira en ${ttlHours} hora${ttlHours === 1 ? '' : 's'}.
        </p>
        <p>
          <a class="link" href="${resetUrl}">Restablecer contraseña</a>
        </p>
        <p style="margin-top: 24px; margin-bottom: 16px; color: #666;">
          Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no se modificará.
        </p>
        <p style="margin-bottom: 0; color: #666; font-size: 14px;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
          <a href="${resetUrl}" style="color: #93C01F; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
      ${footer()}
    </body>
  </html>
`;
