import { memoryStorage } from 'multer';

export const multerMemoryConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
};
