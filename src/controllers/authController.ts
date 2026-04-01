import type { Request, Response } from 'express';

import Joi from 'joi';
import { v4 as uuid } from 'uuid';

import type { AuthRequest } from '../middlewares/auth.js';

import { signAccessToken, signRefreshToken, verifyToken } from '../libs/jwt.js';
import { comparePassword, createHash } from '../libs/passwordHashing.js';
import {
  findLinkedDeviceByUserIdAndDeviceId,
  upsertLinkedDevice,
} from '../queries/linkedDevice.js';
import {
  createPasswordResetToken,
  deletePasswordResetToken,
  findPasswordResetTokenByToken,
} from '../queries/passwordResetToken.js';
import { createToken } from '../queries/token.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByNumberId,
  updateUser,
  updateUserPassword,
} from '../queries/user.js';

const registerSchema = Joi.object({
  address: Joi.string().allow(''),
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  numberId: Joi.string().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().allow(''),
  type: Joi.string().valid('client', 'admin', 'deliveryDriver').default('client'),
});

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const validation = registerSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;

  const [existingEmail, existingNumberId] = await Promise.all([
    findUserByEmail(body.email),
    findUserByNumberId(body.numberId),
  ]);
  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  if (existingNumberId) {
    res.status(409).json({ error: 'numberId already registered' });
    return;
  }

  const hashedPassword = await createHash(body.password);
  const user = await createUser({
    address: body.address || undefined,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    numberId: body.numberId,
    password: hashedPassword,
    phone: body.phone || undefined,
    type: body.type,
  });

  const accessToken = signAccessToken({ userId: user.id });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createToken({ expirationDate: expiresAt, userId: user.id });

  const { password: _p, ...userWithoutPassword } = user;
  res.status(201).json({
    accessToken,
    user: userWithoutPassword,
  });
}

const loginSchema = Joi.object({
  deviceId: Joi.string().allow(''),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export async function login(req: Request, res: Response): Promise<void> {
  const validation = loginSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { deviceId, email, password } = validation.value;

  const user = await findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createToken({ expirationDate: expiresAt, userId: user.id });

  let refreshToken: string | undefined;
  if (deviceId) {
    refreshToken = signRefreshToken({ userId: user.id });
    const refreshTokenHash = await createHash(refreshToken);
    await upsertLinkedDevice({
      deviceId,
      refreshTokenHash,
      userId: user.id,
    });
  }

  const { password: _p, ...userWithoutPassword } = user;
  res.json({
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  });
}

const requestResetSchema = Joi.object({
  email: Joi.string().email().required(),
});

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const validation = requestResetSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { email } = validation.value;

  const user = await findUserByEmail(email);
  if (user) {
    const token = uuid();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ expiresAt, token, userId: user.id });
  }

  res.json({
    message: 'If the email exists, you will receive instructions to reset your password.',
  });
}

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required(),
  token: Joi.string().required(),
});

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await findUserById(req.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { password: _p, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const validation = resetPasswordSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { newPassword, token } = validation.value;

  const resetRecord = await findPasswordResetTokenByToken(token);
  if (!resetRecord) {
    res.status(400).json({ error: 'Invalid or expired token' });
    return;
  }
  if (new Date() > resetRecord.expiresAt) {
    await deletePasswordResetToken(token);
    res.status(400).json({ error: 'Invalid or expired token' });
    return;
  }

  const hashedPassword = await createHash(newPassword);
  await updateUserPassword(resetRecord.userId, hashedPassword);
  await deletePasswordResetToken(token);

  res.json({ message: 'Password updated successfully' });
}

const updateProfileSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: Joi.string().allow('').optional(),
});

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = updateProfileSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;
  const user = await updateUser(req.userId, {
    address: body.address,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
  });
  const { password: _p, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
}

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = changePasswordSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { currentPassword, newPassword } = validation.value;
  const user = await findUserById(req.userId);
  if (!user || !(await comparePassword(currentPassword, user.password))) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  const hashedPassword = await createHash(newPassword);
  await updateUserPassword(req.userId, hashedPassword);
  res.json({ message: 'Password updated successfully' });
}

const refreshSchema = Joi.object({
  deviceId: Joi.string().allow(''),
  refreshToken: Joi.string().required(),
});

export async function refresh(req: Request, res: Response): Promise<void> {
  const validation = refreshSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { deviceId, refreshToken } = validation.value;

  let payload: { userId: string };
  try {
    payload = verifyToken(refreshToken);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  if (deviceId) {
    const linked = await findLinkedDeviceByUserIdAndDeviceId(payload.userId, deviceId);
    if (!linked || !(await comparePassword(refreshToken, linked.refreshTokenHash))) {
      res.status(401).json({ error: 'Invalid device or refresh token' });
      return;
    }
  }

  const accessToken = signAccessToken({ userId: payload.userId });
  res.json({ accessToken });
}
