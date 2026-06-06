import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findByUsernameCi(username: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .getOne();
  }

  findByEmailCi(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({ order: { id: 'ASC' } });
  }

  save(user: Partial<User>): Promise<User> {
    return this.userRepository.save(user);
  }

  async remove(user: User): Promise<void> {
    await this.userRepository.remove(user);
  }
}
