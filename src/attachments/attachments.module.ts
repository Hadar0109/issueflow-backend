import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { FileValidationService } from './file-validation.service';
import { FileStorageService } from './file-storage.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, Ticket]), AuditModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, FileValidationService, FileStorageService],
})
export class AttachmentsModule {}
