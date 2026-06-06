import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportTicketsDto {
  @Type(() => Number)
  @IsInt()
  projectId: number;
}
