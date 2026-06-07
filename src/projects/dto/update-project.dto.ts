import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateProjectDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
