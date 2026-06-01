import multer from 'multer';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 500 * 1024;

const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no permitido. Usa: jpg, png o webp'));
  }
};

export const imageUploadMiddleware = multer({
  fileFilter,
  limits: { fileSize: MAX_SIZE },
  storage,
}).single('imageUrl');
