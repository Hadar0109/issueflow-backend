import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { UserRole } from '../../common/enums';

export class UpdateUserDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(UserRole)
  role?: UserRole;
}
