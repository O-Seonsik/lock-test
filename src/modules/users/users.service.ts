import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Users } from './entities/users.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<Users> {
    const retires = 3;
    let currentRetry = 0;

    const user = this.userRepository.create(createUserDto);
    while (currentRetry < retires) {
      try {
        await this.userRepository.save(user);
        return user;
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          err.message === 'ER_LOCK_DEADLOCK'
        ) {
          this.logger.warn(
            `Deadlock occurred, retrying (attempt ${currentRetry + 1}/${retires})`,
          );
          currentRetry += 1;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          throw err;
        }
      }
    }

    throw new Error('Failed to create user after multiple retries');
  }
}
