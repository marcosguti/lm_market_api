import type { Request, Response } from 'express';

import { findAllDepartmentsForCatalog } from '../../queries/brandDepartment.js';

export async function getDepartments(_req: Request, res: Response): Promise<void> {
  const data = await findAllDepartmentsForCatalog();
  res.json({ data });
}
