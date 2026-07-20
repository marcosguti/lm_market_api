import { Router } from 'express';

import { createContact } from '../controllers/contact/create.js';

const router = Router();

router.post('/', createContact);

export default router;
