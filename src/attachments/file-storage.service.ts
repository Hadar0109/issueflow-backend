import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class FileStorageService {
  constructor(private readonly configService: ConfigService) {}

  getBasePath(): string {
    return this.configService.get<string>('attachmentsPath', './storage/attachments');
  }

  async ensureDirectory(ticketId: number): Promise<string> {
    const dir = join(this.getBasePath(), 'tickets', String(ticketId));
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async save(ticketId: number, originalName: string, buffer: Buffer): Promise<string> {
    const dir = await this.ensureDirectory(ticketId);
    const filename = `${randomUUID()}-${this.sanitizeFilename(originalName)}`;
    const fullPath = join(dir, filename);
    await fs.writeFile(fullPath, buffer);
    return fullPath;
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch {
      // ignore missing files
    }
  }
}
