import { UsersService } from './users.service';
import { QueryFailedError, Repository } from 'typeorm';
import { Users } from './entities/users.entity';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

describe(`UsersService`, () => {
  let service: UsersService;
  let userRepository: Repository<Users>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({ isGlobal: true, cache: true }),
        DatabaseModule,
      ],
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(Users),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<Users>>(getRepositoryToken(Users));
  });

  describe(`createUser`, () => {
    it(`should create a new user`, async () => {
      const createUserDto = { name: 'testUser', email: 'test@example.com' };
      jest
        .spyOn(userRepository, 'create')
        .mockReturnValue({ id: 1, ...createUserDto } as Users);
      jest.spyOn(userRepository, 'save').mockResolvedValue({ id: 1 } as Users);

      const user = await service.createUser(createUserDto);
      expect(user).toEqual({ id: 1, ...createUserDto });
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(userRepository.save).toHaveBeenCalledWith({
        id: 1,
        ...createUserDto,
      });
    });

    it(`should retry on deadlock error`, async () => {
      const createUserDto = { name: 'testUser', email: 'test@example.com' };
      let callCount = 0;
      jest
        .spyOn(userRepository, 'create')
        .mockReturnValue({ id: 1, ...createUserDto } as Users);
      jest.spyOn(userRepository, 'save').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          return { id: 1, ...createUserDto } as Users;
        } else {
          throw new QueryFailedError(
            'query',
            [],
            new Error('ER_LOCK_DEADLOCK'),
          );
        }
      });

      const user = await service.createUser(createUserDto);
      expect(user).toEqual({ id: 1, ...createUserDto });
      expect(userRepository.create).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw error after maximum retries', async () => {
      const createUserDto = { name: 'testuser', email: 'test@example.com' };
      jest
        .spyOn(userRepository, 'create')
        .mockReturnValue({ id: 1, ...createUserDto } as Users);
      jest.spyOn(userRepository, 'save').mockImplementation(async () => {
        throw new QueryFailedError('query', [], new Error('ER_LOCK_DEADLOCK'));
      });

      await expect(service.createUser(createUserDto)).rejects.toThrowError(
        'Failed to create user after multiple retries',
      );
      expect(userRepository.create).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledTimes(3);
    });
  });
});
