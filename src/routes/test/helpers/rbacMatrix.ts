import type { UserType } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

import { authHeader, mockAuthenticatedUser } from './authHelpers.js';

export type HttpMethod = 'delete' | 'get' | 'patch' | 'post';

export interface RbacRequestOptions {
  body?: Record<string, unknown>;
  path?: string;
}

function resolvePath(template: string, pathParams?: Record<string, string>): string {
  if (!pathParams) return template;
  return Object.entries(pathParams).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    template,
  );
}

export async function expectUnauthorized(
  app: Express,
  method: HttpMethod,
  pathTemplate: string,
  options: RbacRequestOptions & { pathParams?: Record<string, string> } = {},
): Promise<void> {
  const path = resolvePath(options.path ?? pathTemplate, options.pathParams);
  const req = request(app)[method](path);
  if (options.body) req.send(options.body);
  const res = await req;
  expect(res.status).toBe(401);
}

export async function expectForbidden(
  app: Express,
  method: HttpMethod,
  pathTemplate: string,
  role: UserType,
  options: RbacRequestOptions & { pathParams?: Record<string, string>; userId?: string } = {},
): Promise<void> {
  const userId = options.userId ?? 'u1';
  mockAuthenticatedUser(userId, role);
  const path = resolvePath(options.path ?? pathTemplate, options.pathParams);
  const req = request(app)[method](path).set(authHeader());
  if (options.body) req.send(options.body);
  const res = await req;
  expect(res.status).toBe(403);
}

export async function expectAllowed(
  app: Express,
  method: HttpMethod,
  pathTemplate: string,
  role: UserType,
  options: RbacRequestOptions & {
    expectedStatus?: number;
    pathParams?: Record<string, string>;
    userId?: string;
  } = {},
): Promise<void> {
  const userId = options.userId ?? 'u1';
  mockAuthenticatedUser(userId, role);
  const path = resolvePath(options.path ?? pathTemplate, options.pathParams);
  const req = request(app)[method](path).set(authHeader());
  if (options.body) req.send(options.body);
  const res = await req;
  if (options.expectedStatus !== undefined) {
    expect(res.status).toBe(options.expectedStatus);
    return;
  }
  expect(res.status).not.toBe(401);
  expect(res.status).not.toBe(403);
}

export const NON_CLIENT_ROLES: UserType[] = ['admin', 'superAdmin', 'deliveryDriver'];
export const ALL_ROLES: UserType[] = ['client', 'admin', 'superAdmin', 'deliveryDriver'];
export const ADMIN_ROLES: UserType[] = ['admin', 'superAdmin'];
