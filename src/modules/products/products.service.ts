import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { QueryRunner } from 'typeorm/query-runner/QueryRunner';

@Injectable()
export class ProductsService {
  private readonly logger: Logger = new Logger(this.constructor.name);
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
