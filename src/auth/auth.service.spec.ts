import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { TokenRevocationService } from './token-revocation.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'createQueryBuilder' | 'save'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let queryBuilder: {
    where: jest.Mock;
    getOne: jest.Mock;
  };

  const baseUser: User = {
    id: 2,
    username: 'dev',
    email: 'dev@example.com',
    fullName: 'Developer',
    role: UserRole.DEVELOPER,
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };

    service = new AuthService(
      userRepository as unknown as Repository<User>,
      jwtService as unknown as JwtService,
      { get: jest.fn().mockReturnValue(3600) } as unknown as ConfigService,
      {} as TokenRevocationService,
      {} as AuditService,
    );
  });

  it('enrolls password on first login when passwordHash is null', async () => {
    queryBuilder.getOne.mockResolvedValue({ ...baseUser });
    userRepository.save.mockImplementation(async (user) => user as User);

    const result = await service.login({ username: 'dev', password: 'new-secret' });

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.any(String),
      }),
    );
    const savedHash = userRepository.save.mock.calls[0][0].passwordHash as string;
    expect(await bcrypt.compare('new-secret', savedHash)).toBe(true);
    expect(result.accessToken).toBe('jwt-token');
  });

  it('verifies bcrypt password on subsequent login', async () => {
    const passwordHash = await bcrypt.hash('stored-secret', 10);
    queryBuilder.getOne.mockResolvedValue({ ...baseUser, passwordHash });

    await service.login({ username: 'dev', password: 'stored-secret' });

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalled();
  });

  it('returns 401 for wrong password when passwordHash is set', async () => {
    const passwordHash = await bcrypt.hash('stored-secret', 10);
    queryBuilder.getOne.mockResolvedValue({ ...baseUser, passwordHash });

    await expect(
      service.login({ username: 'dev', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 for empty username or password', async () => {
    await expect(service.login({ username: '', password: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns 401 for unknown username', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.login({ username: 'nobody', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
