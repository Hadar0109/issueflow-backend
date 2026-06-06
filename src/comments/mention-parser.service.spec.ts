import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MentionParserService } from './mention-parser.service';
import { User } from '../users/entities/user.entity';
import { Mention } from './entities/mention.entity';

describe('MentionParserService', () => {
  let service: MentionParserService;
  const userQb = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    userQb.getOne.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentionParserService,
        {
          provide: getRepositoryToken(User),
          useValue: { createQueryBuilder: () => userQb },
        },
        {
          provide: getRepositoryToken(Mention),
          useValue: { delete: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(MentionParserService);
  });

  it('ignores unknown @mentions', async () => {
    userQb.getOne.mockResolvedValue(null);
    const users = await service.getMentionedUsers('Hello @unknown');
    expect(users).toEqual([]);
  });

  it('resolves known @mentions case-insensitively', async () => {
    userQb.getOne.mockResolvedValue({
      id: 1,
      username: 'jdoe',
      fullName: 'John Doe',
    });
    const users = await service.getMentionedUsers('Hey @JDOE');
    expect(users).toEqual([{ id: 1, username: 'jdoe', fullName: 'John Doe' }]);
  });
});
