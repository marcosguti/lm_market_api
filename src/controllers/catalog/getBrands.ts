import type { Request, Response } from 'express';

import { findAllBrandsForCatalog } from '../../queries/brandDepartment.js';

export async function getBrands(_req: Request, res: Response): Promise<void> {
  const data = await findAllBrandsForCatalog();
  res.json({ data });
}
