import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { FileValidationService } from './file-validation.service';
import { FileStorageService } from './file-storage.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly fileValidationService: FileValidationService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
  ) {}

  async upload(ticketId: number, file: Express.Multer.File, actorId: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, deletedAt: IsNull() },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await this.fileValidationService.validate(file);
    const storagePath = await this.fileStorageService.save(
      ticketId,
      file.originalname,
      file.buffer,
    );

    const attachment = await this.attachmentRepository.save({
      ticketId,
      filename: file.originalname,
      contentType: file.mimetype,
      storagePath,
      sizeBytes: file.size,
    });

    await this.auditService.log({
      action: AuditAction.UPLOAD,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: attachment.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });

    return {
      id: attachment.id,
      ticketId: attachment.ticketId,
      filename: attachment.filename,
      contentType: attachment.contentType,
    };
  }

  async delete(ticketId: number, attachmentId: number, actorId: number): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.fileStorageService.delete(attachment.storagePath);
    await this.attachmentRepository.delete(attachmentId);
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: attachmentId,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
  }
}
