import type { Request, Response } from 'express';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendContactEmail = vi.fn();

vi.mock('../../../libs/sendEmail/index.js', () => ({
  sendContactEmail: (...args: unknown[]) => sendContactEmail(...args),
}));

import { createContact } from '../create.js';

function mockRes() {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
}

const validBody = {
  area: 'ventas',
  email: 'cliente@test.com',
  message: 'Quiero información sobre un producto disponible.',
  name: 'Ana',
  subject: 'Consulta de producto',
};

describe('createContact controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const res = mockRes();
    await createContact({ body: { ...validBody, email: 'bad' } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('sends email and returns success without auth', async () => {
    sendContactEmail.mockResolvedValue(undefined);
    const res = mockRes();
    await createContact({ body: validBody } as Request, res);
    expect(sendContactEmail).toHaveBeenCalledWith(validBody);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Tu mensaje fue enviado. Te responderemos a la brevedad.',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 502 when Mailjet fails', async () => {
    sendContactEmail.mockRejectedValue(new Error('mailjet down'));
    const res = mockRes();
    await createContact({ body: validBody } as Request, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.',
    });
  });
});
