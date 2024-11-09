import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({ isGlobal: true, cache: true }),
        DatabaseModule,
      ],
      providers: [ConfigService, ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  /**
   * 공유 락을 통한 조회 중 배타 락을 통한 조회시
   * 락을 획득 하지 못해 timeout(3000ms) 되는 테스트
   */
  it('should be timeout', async () => {
    const datasource = service.getDatasource();
    const runner1 = datasource.createQueryRunner();
    const runner2 = datasource.createQueryRunner();

    const test = async () => {
      // transaction 1 시작
      await runner1.startTransaction();
      try {
        // transaction 1에서 공유 락 쿼리 실행
        const sharedLockResult = await service.findBySharedLock(runner1, 1);
        console.log(sharedLockResult);

        // transaction 2 시작
        await runner2.startTransaction();
        try {
          // transaction 2에서 배타 락 쿼리 실행
          const exclusiveLockResult = await service.findByExclusiveLock(
            runner2,
            1,
          );
          console.log(exclusiveLockResult);

          // transaction 2 커밋
          await runner2.commitTransaction();
        } catch (e) {
          console.error(`findByExclusiveLock Error: ${e.message}`);
          // return error for test
          return e;
        } finally {
          // transaction 2 리소스 해제
          await runner2.release();
        }

        // transaction 1 커밋
        await runner1.commitTransaction();
      } catch (e) {
        console.error(`findBySharedLock Error: ${e.message}`);
      } finally {
        // transaction 1 리소스 해제
        await runner1.release();
      }
    };

    await expect(test()).resolves.toThrow(
      new Error('Timeout: Query took too long'),
    );
  });
});
