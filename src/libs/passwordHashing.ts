import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createHash(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
