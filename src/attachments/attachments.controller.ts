import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { multerMemoryConfig } from './multer.config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('tickets/:ticketId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @HttpCode(200)
  @Post()
  @UseInterceptors(FileInterceptor('file', multerMemoryConfig))
  upload(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.attachmentsService.upload(ticketId, file, user.id);
  }

  @HttpCode(200)
  @Delete(':attachmentId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.attachmentsService.delete(ticketId, attachmentId, user.id);
  }
}
