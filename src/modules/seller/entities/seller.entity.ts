import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity()
export class Seller {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
    comment: '판매자 유일식별자',
  })
  id: number;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    comment: '판매자 명',
  })
  name: string;

  @Column({ type: 'int', default: 0, nullable: true, comment: '판매 수익' })
  revenue: number;

  // 낙관적 락에 사용할 버전 컬럼
  @VersionColumn()
  version: number;
}
