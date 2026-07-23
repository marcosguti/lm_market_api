import { describe, expect, it } from 'vitest';

import { generateStrongPassword } from '../generateStrongPassword.js';

const PASSWORD_STRENGTH = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

describe('generateStrongPassword', () => {
  it('meets password strength policy', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generateStrongPassword();
      expect(password).toMatch(PASSWORD_STRENGTH);
      expect(password).toHaveLength(14);
    }
  });

  it('supports custom length', () => {
    const password = generateStrongPassword(10);
    expect(password).toHaveLength(10);
    expect(password).toMatch(PASSWORD_STRENGTH);
  });

  it('rejects length below 8', () => {
    expect(() => generateStrongPassword(7)).toThrow(/at least 8/);
  });
});
