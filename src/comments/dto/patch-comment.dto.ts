import { IsNotEmpty, IsString } from 'class-validator';

export class PatchCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
