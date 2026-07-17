import { describe, expect, it } from 'vitest';

import { LOGO_CONTENT_ID } from '../logo.js';
import { BRAND } from '../templates/common.js';
import { getEmailVerificationTemplate } from '../templates/emailVerification.js';
import { getLoginCodeTemplate } from '../templates/loginCode.js';
import { getOrderCancelledTemplate } from '../templates/orderCancelled.js';
import { getPasswordResetTemplate } from '../templates/passwordReset.js';

describe('email templates', () => {
  it('verification template uses brand primary color and code box', () => {
    const html = getEmailVerificationTemplate({
      code: '1234',
      firstName: 'Marco',
      ttlMinutes: 30,
    });

    expect(html).toContain(BRAND.primary);
    expect(html).toContain('1234');
    expect(html).toContain('Hola Marco');
    expect(html).toContain('Tu código de verificación');
    expect(html).toContain('Expira en 30 minutos');
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
  });

  it('password reset template uses brand primary button and link', () => {
    const html = getPasswordResetTemplate({
      firstName: 'Ana',
      resetUrl: 'https://www.lmmarket.com/restablecer-password?token=abc',
      ttlHours: 1,
    });

    expect(html).toContain(BRAND.primary);
    expect(html).toContain('Restablecer contraseña');
    expect(html).toContain('Hola Ana');
    expect(html).toContain('https://www.lmmarket.com/restablecer-password?token=abc');
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
  });

  it('login code template includes inline logo reference', () => {
    const html = getLoginCodeTemplate({
      code: '5678',
      firstName: 'Luis',
      ttlMinutes: 10,
    });

    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
    expect(html).toContain('5678');
  });

  it('escapes user-provided names in HTML output', () => {
    const html = getEmailVerificationTemplate({
      code: '0000',
      firstName: '<script>',
      ttlMinutes: 15,
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('order cancelled template includes reason and short order id', () => {
    const html = getOrderCancelledTemplate({
      firstName: 'Marco',
      reason: 'Producto agotado <script>',
      shortOrderId: '#a5350180',
    });

    expect(html).toContain('Hola Marco');
    expect(html).toContain('#a5350180');
    expect(html).toContain('Motivo de cancelación');
    expect(html).toContain('Producto agotado &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`src="cid:${LOGO_CONTENT_ID}"`);
  });
});
