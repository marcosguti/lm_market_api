import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mailjetRequest = vi.hoisted(() => vi.fn());
const mailjetPost = vi.hoisted(() => vi.fn(() => ({ request: mailjetRequest })));
const apiConnect = vi.hoisted(() => vi.fn(() => ({ post: mailjetPost })));

vi.mock('node-mailjet', () => ({
  default: { apiConnect },
}));

vi.mock('../logo.js', () => ({
  getLogoInlineAttachment: vi.fn(() => ({
    ContentType: 'image/png',
    ContentID: 'logo',
    Filename: 'logo.png',
    Base64Content: 'base64',
  })),
  LOGO_CONTENT_ID: 'logo',
}));

import {
  sendContactEmail,
  sendEmailVerificationCode,
  sendLoginCode,
  sendPasswordResetEmail,
} from '../index.js';

function stubMailjetEnv(): void {
  vi.stubEnv('MAILJET_API_KEY', 'test-key');
  vi.stubEnv('MAILJET_SECRET_KEY', 'test-secret');
  vi.stubEnv('MAIL_FROM_EMAIL', 'noreply@test.com');
  vi.stubEnv('MAIL_FROM_NAME', 'LM Market Test');
  vi.stubEnv('SUPPORT_EMAIL', 'Soporte@lmmarketca.com');
}

function mockSuccessResponse(): void {
  mailjetRequest.mockResolvedValue({
    body: { Messages: [{ Status: 'success', MessageID: 123 }] },
    response: { status: 200 },
  });
}

describe('sendEmail transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubMailjetEnv();
    mockSuccessResponse();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('sendEmailVerificationCode', () => {
    it('sends verification email successfully', async () => {
      await sendEmailVerificationCode({
        code: '1234',
        email: 'user@test.com',
        firstName: 'Marco',
        ttlMinutes: 30,
      });

      expect(apiConnect).toHaveBeenCalledWith('test-key', 'test-secret');
      expect(mailjetPost).toHaveBeenCalledWith('send', { version: 'v3.1' });
      expect(mailjetRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          Messages: [expect.objectContaining({ Subject: 'Verifica tu email — LM Market' })],
        }),
      );
    });

    it('throws when MAILJET_API_KEY is missing', async () => {
      vi.stubEnv('MAILJET_API_KEY', '');
      await expect(
        sendEmailVerificationCode({
          code: '1234',
          email: 'user@test.com',
          firstName: 'Marco',
          ttlMinutes: 30,
        }),
      ).rejects.toThrow(/MAILJET_API_KEY/);
    });

    it('throws when Mailjet returns non-success status', async () => {
      mailjetRequest.mockResolvedValue({
        body: { Messages: [{ Status: 'error', Errors: [{ ErrorMessage: 'fail' }] }] },
      });

      await expect(
        sendEmailVerificationCode({
          code: '1234',
          email: 'user@test.com',
          firstName: 'Marco',
          ttlMinutes: 30,
        }),
      ).rejects.toThrow(/Mailjet status/);
    });

    it('logs and rethrows Mailjet network errors', async () => {
      const err = Object.assign(new Error('network'), {
        response: { status: 500, body: { ErrorMessage: 'down' } },
      });
      mailjetRequest.mockRejectedValue(err);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        sendEmailVerificationCode({
          code: '1234',
          email: 'user@test.com',
          firstName: 'Marco',
          ttlMinutes: 30,
        }),
      ).rejects.toThrow('network');

      expect(consoleSpy).toHaveBeenCalledWith('[mailjet] send failed', expect.any(Object));
      consoleSpy.mockRestore();
    });
  });

  describe('sendLoginCode', () => {
    it('sends login code email successfully', async () => {
      await sendLoginCode({
        code: '5678',
        email: 'user@test.com',
        firstName: 'Ana',
        ttlMinutes: 10,
      });

      expect(mailjetRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          Messages: [expect.objectContaining({ Subject: 'Tu código de acceso — LM Market' })],
        }),
      );
    });

    it('throws when MAIL_FROM_EMAIL is missing', async () => {
      vi.stubEnv('MAIL_FROM_EMAIL', '');
      await expect(
        sendLoginCode({
          code: '5678',
          email: 'user@test.com',
          firstName: 'Ana',
          ttlMinutes: 10,
        }),
      ).rejects.toThrow(/MAIL_FROM_EMAIL/);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email and masks token in logs', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await sendPasswordResetEmail({
        email: 'user@test.com',
        firstName: 'Luis',
        resetUrl: 'https://app.test/reset?token=secret-token-xyz',
        ttlHours: 1,
      });

      expect(mailjetRequest).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        '[mailjet] sending password reset',
        expect.objectContaining({
          resetUrl: expect.stringContaining('***'),
        }),
      );
      infoSpy.mockRestore();
    });

    it('throws when MAILJET_SECRET_KEY is missing', async () => {
      vi.stubEnv('MAILJET_SECRET_KEY', '');
      await expect(
        sendPasswordResetEmail({
          email: 'user@test.com',
          firstName: 'Luis',
          resetUrl: 'https://app.test/reset?token=abc',
          ttlHours: 1,
        }),
      ).rejects.toThrow(/MAILJET_SECRET_KEY/);
    });
  });

  describe('sendContactEmail', () => {
    it('sends contact email to SUPPORT_EMAIL with Reply-To', async () => {
      await sendContactEmail({
        area: 'ventas',
        email: 'cliente@test.com',
        message: 'Quiero información sobre un pedido.',
        name: 'Marco',
        subject: 'Consulta de pedido',
      });

      expect(mailjetRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          Messages: [
            expect.objectContaining({
              ReplyTo: { Email: 'cliente@test.com' },
              Subject: '[Contacto · Ventas] Consulta de pedido',
              To: [{ Email: 'Soporte@lmmarketca.com' }],
            }),
          ],
        }),
      );
    });

    it('throws when SUPPORT_EMAIL is missing', async () => {
      vi.stubEnv('SUPPORT_EMAIL', '');
      await expect(
        sendContactEmail({
          area: 'soporte',
          email: 'cliente@test.com',
          message: 'Necesito ayuda con mi cuenta.',
          name: 'Ana',
          subject: 'Ayuda',
        }),
      ).rejects.toThrow(/SUPPORT_EMAIL/);
    });
  });
});
