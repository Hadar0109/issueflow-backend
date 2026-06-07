import { BadRequestException, Injectable } from '@nestjs/common';
import { fromBuffer } from 'file-type';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
]);

@Injectable()
export class FileValidationService {
  async validate(file: Express.Multer.File): Promise<void> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds maximum size of 10 MB');
    }
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
      throw new BadRequestException('File content does not match allowed types');
    }
  }
}
