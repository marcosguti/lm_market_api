import Mailjet from 'node-mailjet';

import { getLogoInlineAttachment } from './logo.js';
import { getContactMessageTemplate } from './templates/contactMessage.js';
import { getEmailVerificationTemplate } from './templates/emailVerification.js';
import { getLoginCodeTemplate } from './templates/loginCode.js';
import { getOrderCancelledTemplate } from './templates/orderCancelled.js';
import { getPasswordResetTemplate } from './templates/passwordReset.js';

type MailjetApi = {
  apiConnect: (apiKey: string, apiSecret: string) => MailjetClient;
};

type MailjetClient = {
  post: (
    resource: string,
    config?: { version: string },
  ) => { request: (body: unknown) => Promise<MailjetSendResult> };
};

type MailjetConfig = {
  apiKey: string;
  apiSecret: string;
  fromEmail: string;
  fromName: string;
};

type MailjetSendBody = {
  Messages?: Array<{
    Errors?: unknown[];
    MessageID?: number;
    Status?: string;
  }>;
};

type MailjetSendResult = {
  body?: MailjetSendBody;
  response?: { status?: number };
};

const assertMailjetConfig = (): MailjetConfig => {
  const apiKey = process.env.MAILJET_API_KEY?.trim();
  const apiSecret = process.env.MAILJET_SECRET_KEY?.trim();
  const fromEmail = process.env.MAIL_FROM_EMAIL?.trim();
  const fromName = process.env.MAIL_FROM_NAME?.trim() || 'LM Market';

  if (!apiKey) {
    throw new Error('[mailjet] Missing MAILJET_API_KEY in .env');
  }
  if (!apiSecret) {
    throw new Error('[mailjet] Missing MAILJET_SECRET_KEY in .env');
  }
  if (!fromEmail) {
    throw new Error('[mailjet] Missing MAIL_FROM_EMAIL in .env');
  }

  return { apiKey, apiSecret, fromEmail, fromName };
};

const getMailjetClient = (): MailjetClient => {
  const { apiKey, apiSecret } = assertMailjetConfig();
  return (Mailjet as unknown as MailjetApi).apiConnect(apiKey, apiSecret);
};

const maskResetUrl = (resetUrl: string): string => {
  try {
    const url = new URL(resetUrl);
    const token = url.searchParams.get('token');
    if (!token) return resetUrl;
    const masked = token.length <= 4 ? '***' : `***${token.slice(-4)}`;
    url.searchParams.set('token', masked);
    return url.toString();
  } catch {
    return resetUrl.replace(/token=[^&]+/, 'token=***');
  }
};

const buildMailjetMessage = ({
  htmlPart,
  replyToEmail,
  subject,
  toEmail,
}: {
  htmlPart: string;
  replyToEmail?: string;
  subject: string;
  toEmail: string;
}) => {
  const { fromEmail, fromName } = assertMailjetConfig();

  return {
    From: {
      Email: fromEmail,
      Name: fromName,
    },
    HTMLPart: htmlPart,
    InlinedAttachments: [getLogoInlineAttachment()],
    ...(replyToEmail
      ? {
          ReplyTo: {
            Email: replyToEmail,
          },
        }
      : {}),
    Subject: subject,
    To: [{ Email: toEmail }],
  };
};

const assertSupportEmail = (): string => {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  if (!supportEmail) {
    throw new Error('[mailjet] Missing SUPPORT_EMAIL in .env');
  }
  return supportEmail;
};

const AREA_SUBJECT_LABELS: Record<string, string> = {
  contacto: 'Contacto',
  mercadeo: 'Mercadeo',
  soporte: 'Soporte',
  'talento-humano': 'Talento Humano',
  ventas: 'Ventas',
};

const logMailjetSendFailure = (err: unknown): void => {
  if (err && typeof err === 'object') {
    const error = err as {
      message?: string;
      response?: { body?: unknown; status?: number };
      statusCode?: number;
    };

    console.error('[mailjet] send failed', {
      body: error.response?.body,
      message: error.message,
      status: error.response?.status ?? error.statusCode,
    });
    return;
  }

  console.error('[mailjet] send failed', err);
};

export const sendEmailVerificationCode = async ({
  code,
  email,
  firstName,
  ttlMinutes,
}: {
  code: string;
  email: string;
  firstName: string;
  ttlMinutes: number;
}): Promise<void> => {
  const { fromEmail } = assertMailjetConfig();
  const mailjet = getMailjetClient();

  const payload = {
    Messages: [
      buildMailjetMessage({
        htmlPart: getEmailVerificationTemplate({ code, firstName, ttlMinutes }),
        subject: 'Verifica tu email — LM Market',
        toEmail: email,
      }),
    ],
  };

  // eslint-disable-next-line no-console
  console.info('[mailjet] sending email verification', {
    from: fromEmail,
    to: email,
  });

  try {
    const response = await mailjet.post('send', { version: 'v3.1' }).request(payload);
    const message = response.body?.Messages?.[0];
    const status = message?.Status;

    // eslint-disable-next-line no-console
    console.info('[mailjet] send response', {
      errors: message?.Errors,
      messageId: message?.MessageID,
      status,
    });

    if (status !== 'success') {
      throw new Error(
        `Mailjet status: ${status ?? 'unknown'} - ${JSON.stringify(message?.Errors ?? response.body)}`,
      );
    }
  } catch (err) {
    logMailjetSendFailure(err);
    throw err;
  }
};

export const sendLoginCode = async ({
  code,
  email,
  firstName,
  ttlMinutes,
}: {
  code: string;
  email: string;
  firstName: string;
  ttlMinutes: number;
}): Promise<void> => {
  const { fromEmail } = assertMailjetConfig();
  const mailjet = getMailjetClient();

  const payload = {
    Messages: [
      buildMailjetMessage({
        htmlPart: getLoginCodeTemplate({ code, firstName, ttlMinutes }),
        subject: 'Tu código de acceso — LM Market',
        toEmail: email,
      }),
    ],
  };

  // eslint-disable-next-line no-console
  console.info('[mailjet] sending login code', {
    from: fromEmail,
    to: email,
  });

  try {
    const response = await mailjet.post('send', { version: 'v3.1' }).request(payload);
    const message = response.body?.Messages?.[0];
    const status = message?.Status;

    // eslint-disable-next-line no-console
    console.info('[mailjet] send response', {
      errors: message?.Errors,
      messageId: message?.MessageID,
      status,
    });

    if (status !== 'success') {
      throw new Error(
        `Mailjet status: ${status ?? 'unknown'} - ${JSON.stringify(message?.Errors ?? response.body)}`,
      );
    }
  } catch (err) {
    logMailjetSendFailure(err);
    throw err;
  }
};

export const sendPasswordResetEmail = async ({
  email,
  firstName,
  resetUrl,
  ttlHours,
}: {
  email: string;
  firstName: string;
  resetUrl: string;
  ttlHours: number;
}): Promise<void> => {
  const { fromEmail } = assertMailjetConfig();
  const mailjet = getMailjetClient();

  const payload = {
    Messages: [
      buildMailjetMessage({
        htmlPart: getPasswordResetTemplate({ firstName, resetUrl, ttlHours }),
        subject: 'Restablece tu contraseña — LM Market',
        toEmail: email,
      }),
    ],
  };

  // eslint-disable-next-line no-console
  console.info('[mailjet] sending password reset', {
    from: fromEmail,
    resetUrl: maskResetUrl(resetUrl),
    to: email,
  });

  try {
    const response = await mailjet.post('send', { version: 'v3.1' }).request(payload);
    const message = response.body?.Messages?.[0];
    const status = message?.Status;

    // eslint-disable-next-line no-console
    console.info('[mailjet] send response', {
      errors: message?.Errors,
      messageId: message?.MessageID,
      status,
    });

    if (status !== 'success') {
      throw new Error(
        `Mailjet status: ${status ?? 'unknown'} - ${JSON.stringify(message?.Errors ?? response.body)}`,
      );
    }
  } catch (err) {
    logMailjetSendFailure(err);
    throw err;
  }
};

export const sendOrderCancelledEmail = async ({
  email,
  firstName,
  reason,
  shortOrderId,
}: {
  email: string;
  firstName: string;
  reason: string;
  shortOrderId: string;
}): Promise<void> => {
  const { fromEmail } = assertMailjetConfig();
  const mailjet = getMailjetClient();

  const payload = {
    Messages: [
      buildMailjetMessage({
        htmlPart: getOrderCancelledTemplate({ firstName, reason, shortOrderId }),
        subject: 'Tu orden fue cancelada — LM Market',
        toEmail: email,
      }),
    ],
  };

  // eslint-disable-next-line no-console
  console.info('[mailjet] sending order cancelled', {
    from: fromEmail,
    shortOrderId,
    to: email,
  });

  try {
    const response = await mailjet.post('send', { version: 'v3.1' }).request(payload);
    const message = response.body?.Messages?.[0];
    const status = message?.Status;

    // eslint-disable-next-line no-console
    console.info('[mailjet] send response', {
      errors: message?.Errors,
      messageId: message?.MessageID,
      status,
    });

    if (status !== 'success') {
      throw new Error(
        `Mailjet status: ${status ?? 'unknown'} - ${JSON.stringify(message?.Errors ?? response.body)}`,
      );
    }
  } catch (err) {
    logMailjetSendFailure(err);
    throw err;
  }
};

export const sendContactEmail = async ({
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
}): Promise<void> => {
  const { fromEmail } = assertMailjetConfig();
  const supportEmail = assertSupportEmail();
  const mailjet = getMailjetClient();
  const areaLabel = AREA_SUBJECT_LABELS[area] ?? area;
  const mailSubject = `[Contacto · ${areaLabel}] ${subject}`;

  const payload = {
    Messages: [
      buildMailjetMessage({
        htmlPart: getContactMessageTemplate({ area, email, message, name, subject }),
        replyToEmail: email,
        subject: mailSubject,
        toEmail: supportEmail,
      }),
    ],
  };

  // eslint-disable-next-line no-console
  console.info('[mailjet] sending contact message', {
    area,
    from: fromEmail,
    replyTo: email,
    to: supportEmail,
  });

  try {
    const response = await mailjet.post('send', { version: 'v3.1' }).request(payload);
    const resultMessage = response.body?.Messages?.[0];
    const status = resultMessage?.Status;

    // eslint-disable-next-line no-console
    console.info('[mailjet] send response', {
      errors: resultMessage?.Errors,
      messageId: resultMessage?.MessageID,
      status,
    });

    if (status !== 'success') {
      throw new Error(
        `Mailjet status: ${status ?? 'unknown'} - ${JSON.stringify(resultMessage?.Errors ?? response.body)}`,
      );
    }
  } catch (err) {
    logMailjetSendFailure(err);
    throw err;
  }
};
