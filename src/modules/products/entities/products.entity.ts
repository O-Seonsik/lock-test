import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('products')
export class Products {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
    comment: '상품 유일식별자',
  })
  id: number;

  @Column({ type: 'varchar', length: 120, nullable: true, comment: '상품명' })
  name: string;

  @Column({ type: 'int', unsigned: true, nullable: true, comment: '상품 가격' })
  price: number;

  @Column({ type: 'int', unsigned: true, nullable: true, comment: '수량' })
  amount: number;

  @Column({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '상품 등록 일시',
  })
  createdAt: Date;
}
