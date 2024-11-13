import { SellerService } from './seller.service';
import { Seller } from './entities/seller.entity';
import {
  DataSource,
  OptimisticLockVersionMismatchError,
  Repository,
} from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('SellerService', () => {
  let service: SellerService;
  let repository: Repository<Seller>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({ isGlobal: true, cache: true }),
        DatabaseModule,
      ],

      providers: [
        ConfigService,
        SellerService,
        {
          provide: getRepositoryToken(Seller),
          useFactory: (dataSource: DataSource) =>
            dataSource.getRepository(Seller),
          inject: [DataSource],
        },
      ],
    }).compile();

    service = module.get<SellerService>(SellerService);
    dataSource = module.get<DataSource>(DataSource);
    repository = module.get<Repository<Seller>>(getRepositoryToken(Seller));

    // 테스트용 판매자 생성
    await repository.save({ id: 1, name: 'testSeller', revenue: 0 } as Seller);
  });

  afterEach(async () => {
    await repository.clear();
    await dataSource.destroy();
  });

  // 낙관적 락 충돌 테스트(typeorm 에서 update 시에 자동으로 version mismatch 를 체크하는지 검사해주는 메서드를 확인하지 못함 -> 직접구현)
  it('should handle optimistic lock conflict', async () => {
    // QueryRunner 인스턴스 생성 및 트랜잭션 시작
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 현재 트랜잭션에서 판매자 정보 조회
      const seller = await queryRunner.manager
        .getRepository(Seller)
        .findOne({ where: { id: 1 } });

      // 별도의 트랜잭션에서 판매자 정보 update
      await service.updateSellerRevenueByOptimisticLock(1, 500);

      // 현재 트랜잭션에서 판매자 정보 업데이트
      seller.revenue += 100;
      const result = await repository.update(
        { id: seller.id, version: seller.version },
        seller,
      );
      // update 가 적용되지 않는다면 version 이 다르다는 의미
      if (result.affected === 0) {
        // Isolation level 에 따라 조회 결과가 다를 수 있어 다른 트랜잭션으로 조회한다.
        const { version: actualVersion } = await repository.findOne({
          where: { id: 1 },
        });

        throw new OptimisticLockVersionMismatchError(
          'seller',
          seller.version,
          actualVersion,
        );
      }

      await queryRunner.commitTransaction();
      throw new Error('OptimisticLockVersionMismatchError expected');
    } catch (e) {
      console.log(e);
      expect(e).toBeInstanceOf(OptimisticLockVersionMismatchError);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  });

  it('should apply pessimistic lock without conflict', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // 첫 번쨰 트랜잭션에서 비관적 락 설정
      await queryRunner.manager.findOne(Seller, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });

      // 비관적 락이 걸린 상태에서 다른 프로세스가 동일한 자원을 업데이트 하려고 하면 대기 상태가 된다.
      const updatePromise = service.updateSellerRevenueByPessimisticLock(
        1,
        1000,
      );

      // 3000ms 후 트랜잭션 커밋
      new Promise((resolve) => setTimeout(resolve, 3000))
        .then(async () => {
          await queryRunner.commitTransaction();
          console.log('Transaction committed');
        })
        .catch(async (err) => {
          await queryRunner.rollbackTransaction();
          throw err;
        })
        .finally(async () => await queryRunner.release());

      // 두 번째 프로세스의 업데이트가 성공했는지 확인
      // 첫 번째 트랜잭션에서 await 하지 않아도 락을 획득할 때 까지 대기하기 때문에 commit 이후 아래 코드 실행
      const updateSeller = await updatePromise.then((seller) => {
        console.log('Seller updated');
        return seller;
      });
      expect(updateSeller.revenue).toBe(1000);
    } catch (err) {
      throw err;
    }
  });
});
