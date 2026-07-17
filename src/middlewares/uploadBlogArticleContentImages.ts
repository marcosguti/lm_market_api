import type { NextFunction, Request, Response } from 'express';

import multer from 'multer';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 1024 * 2 * 1024; // 2MB per file
const MAX_FILES = 20;

const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no permitido. Usa: jpg, png o webp'));
  }
};

const upload = multer({
  fileFilter,
  limits: { files: MAX_FILES, fileSize: MAX_SIZE },
  storage,
}).array('files', MAX_FILES);

export function blogArticleContentImagesUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Cada imagen debe ser menor a 2MB' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({ error: `Máximo ${MAX_FILES} imágenes por artículo` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}
