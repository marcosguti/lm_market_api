import { randomInt } from 'crypto';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALL = LOWER + UPPER + DIGITS;

/** Min length matching auth/admin password strength policy. */
const DEFAULT_LENGTH = 14;

/**
 * Cryptographically random password that satisfies:
 * min 8 chars, at least one lowercase, one uppercase, one digit.
 */
export function generateStrongPassword(length = DEFAULT_LENGTH): string {
  if (length < 8) {
    throw new Error('Password length must be at least 8');
  }

  const chars: string[] = [
    LOWER[randomInt(LOWER.length)]!,
    UPPER[randomInt(UPPER.length)]!,
    DIGITS[randomInt(DIGITS.length)]!,
  ];

  for (let i = chars.length; i < length; i += 1) {
    chars.push(ALL[randomInt(ALL.length)]!);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join('');
}
