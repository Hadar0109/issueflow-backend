import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../common/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
