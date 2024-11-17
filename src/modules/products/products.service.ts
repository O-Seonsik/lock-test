import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { QueryRunner } from 'typeorm/query-runner/QueryRunner';
import { DistributedLockService } from '../distributed-lock/distributed-lock.service';
import { Products } from './entities/products.entity';

@Injectable()
export class ProductsService {
  private readonly logger: Logger = new Logger(this.constructor.name);
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  /**
   * 공유 락을 통해 상품 재고 증가
   * @param amount
   * @param productId
   * @param processId
   */
  async addAmount(amount: number, productId: number, processId: number) {
    // 상품 재고 증가
    const work = async () => {
      const productRepository =
        this.dataSource.getRepository<Products>(Products);
      const product = await productRepository.findOne({
        where: { id: productId },
      });

      product.addAmount(amount);
      return productRepository.save(product);
    };

    return this.distributedLockService.withLock<Products>({
      key: 'addProductAmount',
      work,
      retryDelay: 100,
      processId,
    });
  }

  /**
   * 공유 락을 통한 조회
   * @param runner
   * @param productId
   */
  async findBySharedLock(runner: QueryRunner, productId: number) {
    const result = await runner.query(
      `SELECT amount FROM products WHERE id = ? LOCK IN SHARE MODE`,
      [productId],
    );
    this.logger.log(`testSharedLock Result: ${result}`);
    return result;
  }

  /**
   * 배타 락을 통한 조회
   * 3초 이상 걸리면 timeout
   * @param runner
   * @param productId
   */
  async findByExclusiveLock(runner: QueryRunner, productId: number) {
    try {
      const result = await Promise.race([
        runner.query(`SELECT amount FROM products WHERE id = ? FOR UPDATE`, [
          productId,
        ]),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout: Query took too long')),
            3000,
          ),
        ),
      ]);
      this.logger.log(`testExclusiveLock Result: ${result}`);
      return result;
    } catch (e) {
      throw e;
    }
  }

  /**
   * 데이터 소스 반환
   */
  getDatasource() {
    return this.dataSource;
  }
}
