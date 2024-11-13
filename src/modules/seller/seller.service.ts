import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Seller } from './entities/seller.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class SellerService {
  constructor(
    @InjectDataSource() private readonly datasource: DataSource,
    @InjectRepository(Seller)
    private readonly sellerRepository: Repository<Seller>,
  ) {}

  async updateSellerRevenueByOptimisticLock(
    id: number,
    revenue: number,
  ): Promise<Seller> {
    const seller = await this.sellerRepository.findOne({ where: { id } });
    if (!seller) throw new Error('Seller not found');

    // 판매 수익 업데이트
    seller.revenue += revenue;

    // save 메서드가 내부적으로 버전을 검사하고 충돌이 있을 경우 예외 발생
    return this.sellerRepository.save(seller);
  }

  async updateSellerRevenueByPessimisticLock(
    id: number,
    revenue: number,
  ): Promise<Seller> {
    const queryRunner = this.datasource.createQueryRunner();

    // 트랜잭션 시작
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 비관적 락을 사용하여 사용자를 조회합니다.
      const seller = await queryRunner.manager.findOne(Seller, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!seller) throw new Error('Seller not found');

      // 판매 수익 업데이트
      seller.revenue += revenue;
      await queryRunner.manager.save(seller);
      return seller;
    } catch (err) {
      // 오류 발생 시 롤백
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      // 트랜잭션 종료 후 연결 해제
      await queryRunner.release();
    }

    // select for update 쿼리를 사용하여 특정 판매자 데이터를 잠금
    await this.sellerRepository.manager.query(
      `SELECT * FROM seller WHERE id = ${id} FOR UPDATE`,
    );

    const seller = await this.sellerRepository.findOne({ where: { id } });
    if (!seller) throw new Error('Seller not found');

    // 판매 수익 업데이트
    seller.revenue += revenue;

    return this.sellerRepository.save(seller);
  }
}
