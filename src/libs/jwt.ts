import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET ?? 'default-secret-change-me';
const expiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

export interface JwtPayload {
  type?: string;
  userId: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn: refreshExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
