import type { Request } from 'express';

import 'multer';

export type FileFromMulter = NonNullable<Request['file']>;
