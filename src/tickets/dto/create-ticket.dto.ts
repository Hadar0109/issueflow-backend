import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketPriority, TicketStatus, TicketType } from '../../common/enums';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsEnum(TicketType)
  type: TicketType;

  @IsInt()
  projectId: number;

  @IsOptional()
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
